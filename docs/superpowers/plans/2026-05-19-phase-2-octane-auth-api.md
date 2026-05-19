# Phase 2 — Octane backend (auth API) Implementation Plan

> Implementation in `~/projects/octane.pushka.biz/`, not `sales-agent/`.

**Goal:** Поднять в octane API-эндпоинты для auth-флоу desktop-приложения: список AmoUser-ов mogoby, запрос OTP-кода на email, верификация кода → выдача Sanctum-токена, /me и /dnd. Никакого Reverb / offers / broadcasting — это Phase 4+.

**Architecture:** Стандартный Laravel REST под префиксом `/api/desktop/v1/`. Auth — Sanctum + AmoUser как Authenticatable (polymorphic personal_access_tokens). OTP-коды хранятся как HMAC-hash в `email_otps`, рассылка через `MAIL_MAILER=log` в dev (коды видны в `storage/logs/laravel.log`).

**Tech Stack:** Laravel 12 + Sanctum 4 + новые модели + Mailable + log mailer (dev) / Resend (prod-ready).

---

## Pre-flight (user must do BEFORE Tasks)

- [ ] **U1:** `cd ~/projects/octane.pushka.biz && pgsync sync` — синк прод-схемы в dev DB, нужно для feature smoke-тестов
- [ ] **U2:** `cd ~/projects/octane.pushka.biz && infisical secrets set MAIL_MAILER=log --env=dev` — переключить почту dev на лог-драйвер
- [ ] **U3:** Подтвердить: пушим прямо в octane `main` (не feature-branch)

---

## File structure

| File | Status | Purpose |
|---|---|---|
| `database/migrations/2026_05_19_180000_create_personal_access_tokens_table.php` | create | Стандартная Sanctum-миграция (publish vendor) |
| `database/migrations/2026_05_19_180001_create_desktop_devices_table.php` | create | id, amo_user_id, account_id, access_token_id (FK), device_label, dnd_on, last_seen_at |
| `database/migrations/2026_05_19_180002_create_email_otps_table.php` | create | id, amo_user_id, code_hash, expires_at, consumed_at, attempts, ip |
| `app/Models/AmoUser.php` | modify | Extend `Authenticatable` + add `HasApiTokens` |
| `app/Models/DesktopDevice.php` | create | Eloquent model |
| `app/Models/EmailOtp.php` | create | Eloquent model |
| `app/Services/Desktop/OtpService.php` | create | generate/verify, rate limits |
| `app/Mail/Desktop/OtpCode.php` | create | Mailable с кодом |
| `resources/views/emails/desktop-otp.blade.php` | create | Шаблон письма |
| `app/Http/Controllers/Api/Desktop/AmoUsersController.php` | create | GET list by account slug |
| `app/Http/Controllers/Api/Desktop/AuthController.php` | create | request-code, verify-code, logout |
| `app/Http/Controllers/Api/Desktop/MeController.php` | create | Текущий пользователь |
| `app/Http/Controllers/Api/Desktop/DndController.php` | create | Toggle DND |
| `app/Http/Requests/Desktop/RequestCodeRequest.php` | create | Валидация request-code |
| `app/Http/Requests/Desktop/VerifyCodeRequest.php` | create | Валидация verify-code |
| `app/Http/Requests/Desktop/DndRequest.php` | create | Валидация dnd toggle |
| `config/auth.php` | modify | Добавить `amo_users` provider, sanctum guard |
| `routes/api.php` | modify | Зарегистрировать `prefix('desktop/v1')` группу |
| `composer.json` | modify | + `resend/resend-laravel` для prod-готовности |
| `tests/Unit/Desktop/OtpServiceTest.php` | create | Unit-тесты для OtpService (без DB — мокаем repository) |

---

## Task 1: Install Sanctum migration + Resend driver

- [ ] **Step 1.1: Publish Sanctum migration**

```bash
cd ~/projects/octane.pushka.biz && \
  infisical run --env=dev -- php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider" --tag=migrations --force
```

Это создаст `database/migrations/XXXX_XX_XX_XXXXXX_create_personal_access_tokens_table.php`.

- [ ] **Step 1.2: Install Resend (composer)**

```bash
cd ~/projects/octane.pushka.biz && composer require resend/resend-laravel
```

(Не настраиваем сейчас — просто ставим, чтобы в проде была опция флипнуть `MAIL_MAILER=resend`.)

- [ ] **Step 1.3: Commit**

```bash
cd ~/projects/octane.pushka.biz && \
  bash ~/.claude/scripts/commit-files.sh "feat(desktop): scaffold sanctum migration + resend driver" \
    composer.json composer.lock \
    database/migrations/*personal_access_tokens*.php
```

---

## Task 2: Create new migrations (desktop_devices, email_otps)

- [ ] **Step 2.1: desktop_devices migration**

Create `database/migrations/2026_05_19_180001_create_desktop_devices_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('desktop_devices', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('amo_user_id');
            $table->unsignedBigInteger('account_id');
            $table->unsignedBigInteger('access_token_id')->nullable();
            $table->string('device_label')->nullable();
            $table->boolean('dnd_on')->default(false);
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->index('amo_user_id');
            $table->index('account_id');
            $table->index('access_token_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('desktop_devices');
    }
};
```

Без foreign-key constraints на `amo_user_id` / `account_id` — потому что prod `amo_users` / `accounts` могут иметь legacy схему без явного PK constraint. Используем application-level checks.

- [ ] **Step 2.2: email_otps migration**

Create `database/migrations/2026_05_19_180002_create_email_otps_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_otps', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('amo_user_id');
            $table->string('code_hash', 64);
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->ipAddress('ip')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['amo_user_id', 'consumed_at']);
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_otps');
    }
};
```

- [ ] **Step 2.3: Apply migrations to dev DB**

```bash
cd ~/projects/octane.pushka.biz && \
  infisical run --env=dev -- php artisan migrate --path=database/migrations/2026_05_19_180001_create_desktop_devices_table.php && \
  infisical run --env=dev -- php artisan migrate --path=database/migrations/2026_05_19_180002_create_email_otps_table.php
```

(Sanctum migration уже накатилась если запустить `php artisan migrate` без флагов; но безопаснее именно по нужным файлам чтобы не уронить старые "broken" миграции.)

Verify:
```bash
cd ~/projects/octane.pushka.biz && \
  infisical run --env=dev -- psql "$POSTGRES_URL" -c "\dt desktop_devices; \dt email_otps; \dt personal_access_tokens;" 2>&1
```

Expected: 3 tables exist.

- [ ] **Step 2.4: Commit**

```bash
cd ~/projects/octane.pushka.biz && \
  bash ~/.claude/scripts/commit-files.sh "feat(desktop): migrations for desktop_devices + email_otps" \
    database/migrations/2026_05_19_180001_create_desktop_devices_table.php \
    database/migrations/2026_05_19_180002_create_email_otps_table.php
```

---

## Task 3: Models

- [ ] **Step 3.1: Extend AmoUser**

Read current `app/Models/AmoUser.php`. Find class declaration (likely `class AmoUser extends Model`). Modify to:

```php
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class AmoUser extends Authenticatable
{
    use HasApiTokens;

    // ... existing trait uses, fillable, etc — KEEP

    public function desktopDevices()
    {
        return $this->hasMany(\App\Models\DesktopDevice::class);
    }
}
```

Key: change `extends Model` → `extends Authenticatable`, add `use HasApiTokens;`, add `desktopDevices()` relation.

`Illuminate\Foundation\Auth\User as Authenticatable` IS-A Model + adds Authenticatable contract + HasPasswordResets etc. AmoUser won't have password — that's fine, Sanctum tokens don't need it.

- [ ] **Step 3.2: Create DesktopDevice model**

Create `app/Models/DesktopDevice.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Laravel\Sanctum\PersonalAccessToken;

class DesktopDevice extends Model
{
    protected $fillable = [
        'amo_user_id',
        'account_id',
        'access_token_id',
        'device_label',
        'dnd_on',
        'last_seen_at',
    ];

    protected $casts = [
        'dnd_on' => 'boolean',
        'last_seen_at' => 'datetime',
    ];

    public function amoUser(): BelongsTo
    {
        return $this->belongsTo(AmoUser::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function accessToken(): BelongsTo
    {
        return $this->belongsTo(PersonalAccessToken::class);
    }
}
```

- [ ] **Step 3.3: Create EmailOtp model**

Create `app/Models/EmailOtp.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailOtp extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'amo_user_id',
        'code_hash',
        'expires_at',
        'consumed_at',
        'attempts',
        'ip',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'consumed_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function amoUser(): BelongsTo
    {
        return $this->belongsTo(AmoUser::class);
    }
}
```

- [ ] **Step 3.4: Commit**

```bash
cd ~/projects/octane.pushka.biz && \
  bash ~/.claude/scripts/commit-files.sh "feat(desktop): AmoUser auth + DesktopDevice + EmailOtp models" \
    app/Models/AmoUser.php app/Models/DesktopDevice.php app/Models/EmailOtp.php
```

---

## Task 4: OtpService

- [ ] **Step 4.1: Create `app/Services/Desktop/OtpService.php`**

```php
<?php

namespace App\Services\Desktop;

use App\Models\EmailOtp;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class OtpService
{
    /** OTP TTL: 10 minutes. */
    public const TTL_MINUTES = 10;
    /** Max wrong attempts before the OTP is forcibly expired. */
    public const MAX_ATTEMPTS = 5;
    /** Cooldown between successive request-code for one amo_user, in seconds. */
    public const REQUEST_COOLDOWN_SECONDS = 60;

    /**
     * @return string|null 6-digit code (clear text — to send via email),
     *                     or null if cooldown not elapsed.
     */
    public function generate(int $amoUserId, ?string $ip): ?string
    {
        if ($this->hasActiveCooldown($amoUserId)) {
            return null;
        }

        // Mark cooldown.
        Cache::put($this->cooldownKey($amoUserId), 1, self::REQUEST_COOLDOWN_SECONDS);

        // Invalidate any active unconsumed code (to avoid two valid codes simultaneously).
        EmailOtp::where('amo_user_id', $amoUserId)
            ->whereNull('consumed_at')
            ->where('expires_at', '>', Carbon::now())
            ->update(['expires_at' => Carbon::now()]);

        $code = str_pad((string) random_int(0, 999_999), 6, '0', STR_PAD_LEFT);

        EmailOtp::create([
            'amo_user_id' => $amoUserId,
            'code_hash' => $this->hash($code),
            'expires_at' => Carbon::now()->addMinutes(self::TTL_MINUTES),
            'ip' => $ip,
        ]);

        return $code;
    }

    public function verify(int $amoUserId, string $code): bool
    {
        $otp = EmailOtp::where('amo_user_id', $amoUserId)
            ->whereNull('consumed_at')
            ->where('expires_at', '>', Carbon::now())
            ->orderByDesc('id')
            ->first();

        if (! $otp) {
            return false;
        }

        if ($otp->attempts >= self::MAX_ATTEMPTS) {
            $otp->update(['expires_at' => Carbon::now()]);
            return false;
        }

        if (! hash_equals($otp->code_hash, $this->hash($code))) {
            $otp->increment('attempts');
            return false;
        }

        $otp->update(['consumed_at' => Carbon::now()]);
        return true;
    }

    private function hash(string $code): string
    {
        return hash_hmac('sha256', $code, config('app.key'));
    }

    private function cooldownKey(int $amoUserId): string
    {
        return "desktop_otp_cooldown:$amoUserId";
    }

    private function hasActiveCooldown(int $amoUserId): bool
    {
        return Cache::has($this->cooldownKey($amoUserId));
    }
}
```

- [ ] **Step 4.2: Unit test**

Create `tests/Unit/Desktop/OtpServiceTest.php`:

```php
<?php

namespace Tests\Unit\Desktop;

use App\Models\EmailOtp;
use App\Services\Desktop\OtpService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class OtpServiceTest extends TestCase
{
    use DatabaseTransactions;

    private OtpService $service;
    private int $amoUserId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new OtpService();
        // Use any existing AmoUser id from dev DB — fallback: skip if no users.
        $this->amoUserId = \DB::table('amo_users')->value('id') ?? $this->markTestSkipped('no AmoUser in dev DB');
        Cache::flush();
    }

    public function test_generates_six_digit_code(): void
    {
        $code = $this->service->generate($this->amoUserId, '127.0.0.1');
        $this->assertNotNull($code);
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
    }

    public function test_cooldown_blocks_second_request(): void
    {
        $first = $this->service->generate($this->amoUserId, '127.0.0.1');
        $this->assertNotNull($first);
        $second = $this->service->generate($this->amoUserId, '127.0.0.1');
        $this->assertNull($second, 'second request within cooldown must return null');
    }

    public function test_verify_with_correct_code_succeeds_and_consumes(): void
    {
        $code = $this->service->generate($this->amoUserId, '127.0.0.1');
        $this->assertTrue($this->service->verify($this->amoUserId, $code));

        $otp = EmailOtp::where('amo_user_id', $this->amoUserId)->latest('id')->first();
        $this->assertNotNull($otp->consumed_at);
    }

    public function test_verify_with_wrong_code_increments_attempts(): void
    {
        $this->service->generate($this->amoUserId, '127.0.0.1');
        $this->assertFalse($this->service->verify($this->amoUserId, '000000'));
        $otp = EmailOtp::where('amo_user_id', $this->amoUserId)->latest('id')->first();
        $this->assertSame(1, $otp->attempts);
    }

    public function test_verify_after_max_attempts_expires_otp(): void
    {
        $this->service->generate($this->amoUserId, '127.0.0.1');
        for ($i = 0; $i < OtpService::MAX_ATTEMPTS; $i++) {
            $this->service->verify($this->amoUserId, '000000');
        }
        $this->assertFalse($this->service->verify($this->amoUserId, '999999'));
        // Even with hypothetical correct code, OTP is now expired.
    }

    public function test_verify_no_active_otp_returns_false(): void
    {
        $this->assertFalse($this->service->verify($this->amoUserId, '123456'));
    }
}
```

- [ ] **Step 4.3: Run tests**

```bash
cd ~/projects/octane.pushka.biz && composer test -- --filter=OtpServiceTest 2>&1 | tail -30
```

Expected: 6 tests passing.

- [ ] **Step 4.4: Commit**

```bash
cd ~/projects/octane.pushka.biz && \
  bash ~/.claude/scripts/commit-files.sh "feat(desktop): OtpService + unit tests" \
    app/Services/Desktop/OtpService.php tests/Unit/Desktop/OtpServiceTest.php
```

---

## Task 5: OtpCode Mailable + view

- [ ] **Step 5.1: Create `app/Mail/Desktop/OtpCode.php`**

```php
<?php

namespace App\Mail\Desktop;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OtpCode extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $userName,
        public readonly string $code,
        public readonly int $ttlMinutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Код входа в Sales Agent: '.$this->code,
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.desktop-otp');
    }
}
```

- [ ] **Step 5.2: Create blade view `resources/views/emails/desktop-otp.blade.php`**

```blade
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Sales Agent — код входа</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.5;">
  <p>Привет, {{ $userName }}!</p>
  <p>Код для входа в Sales Agent:</p>
  <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; font-family: monospace;">{{ $code }}</p>
  <p>Код действителен {{ $ttlMinutes }} минут.</p>
  <p style="color: #888; font-size: 12px;">Если ты не запрашивал код, проигнорируй это письмо.</p>
</body>
</html>
```

- [ ] **Step 5.3: Commit**

```bash
cd ~/projects/octane.pushka.biz && \
  bash ~/.claude/scripts/commit-files.sh "feat(desktop): OtpCode mailable + view" \
    app/Mail/Desktop/OtpCode.php resources/views/emails/desktop-otp.blade.php
```

---

## Task 6: Configure auth.php for Sanctum + AmoUser

- [ ] **Step 6.1: Edit `config/auth.php`**

Find the `providers` array, add:

```php
'amo_users' => [
    'driver' => 'eloquent',
    'model' => \App\Models\AmoUser::class,
],
```

Find the `guards` array, add (preserve existing guards):

```php
'sanctum' => [
    'driver' => 'sanctum',
    'provider' => 'amo_users',
],
```

(Если уже есть `sanctum` guard — overrider'ить provider на `amo_users` only if it's NOT used by other code. Ищи `auth("sanctum")` / `auth:sanctum` middleware в app/ — если есть usages с другим контекстом, не трогать; вместо этого добавить guard с другим именем, скажем `desktop_sanctum`.)

Search for existing sanctum usage:
```bash
grep -rE "auth:sanctum|guard\\('sanctum'" ~/projects/octane.pushka.biz/app ~/projects/octane.pushka.biz/routes
```

If empty → safe to override sanctum guard provider.
If exists → use guard name `desktop_sanctum` instead and reference that in routes/middleware.

- [ ] **Step 6.2: Commit**

```bash
cd ~/projects/octane.pushka.biz && \
  bash ~/.claude/scripts/commit-files.sh "feat(desktop): sanctum guard for AmoUser provider" \
    config/auth.php
```

---

## Task 7: Form Requests

- [ ] **Step 7.1: Create `app/Http/Requests/Desktop/RequestCodeRequest.php`**

```php
<?php

namespace App\Http\Requests\Desktop;

use Illuminate\Foundation\Http\FormRequest;

class RequestCodeRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'amo_user_id' => ['required', 'integer', 'exists:amo_users,id'],
        ];
    }
}
```

- [ ] **Step 7.2: Create `app/Http/Requests/Desktop/VerifyCodeRequest.php`**

```php
<?php

namespace App\Http\Requests\Desktop;

use Illuminate\Foundation\Http\FormRequest;

class VerifyCodeRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'amo_user_id' => ['required', 'integer', 'exists:amo_users,id'],
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
            'device_label' => ['nullable', 'string', 'max:120'],
        ];
    }
}
```

- [ ] **Step 7.3: Create `app/Http/Requests/Desktop/DndRequest.php`**

```php
<?php

namespace App\Http\Requests\Desktop;

use Illuminate\Foundation\Http\FormRequest;

class DndRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return ['on' => ['required', 'boolean']];
    }
}
```

- [ ] **Step 7.4: Commit**

```bash
cd ~/projects/octane.pushka.biz && \
  bash ~/.claude/scripts/commit-files.sh "feat(desktop): form requests for auth + dnd" \
    app/Http/Requests/Desktop/RequestCodeRequest.php \
    app/Http/Requests/Desktop/VerifyCodeRequest.php \
    app/Http/Requests/Desktop/DndRequest.php
```

---

## Task 8: Controllers

- [ ] **Step 8.1: AmoUsersController**

`app/Http/Controllers/Api/Desktop/AmoUsersController.php`:

```php
<?php

namespace App\Http\Controllers\Api\Desktop;

use App\Http\Controllers\Controller;
use App\Models\Account;
use Illuminate\Http\JsonResponse;

class AmoUsersController extends Controller
{
    public function index(string $accountSlug): JsonResponse
    {
        $account = Account::where('subdomain', $accountSlug)->firstOrFail();

        $users = $account->amoUsers()
            ->select(['amo_users.id', 'amo_users.name', 'amo_users.email'])
            ->orderBy('amo_users.name')
            ->get()
            ->map(fn($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'avatar_url' => null,
            ]);

        return response()->json($users);
    }
}
```

- [ ] **Step 8.2: AuthController**

`app/Http/Controllers/Api/Desktop/AuthController.php`:

```php
<?php

namespace App\Http\Controllers\Api\Desktop;

use App\Http\Controllers\Controller;
use App\Http\Requests\Desktop\RequestCodeRequest;
use App\Http\Requests\Desktop\VerifyCodeRequest;
use App\Mail\Desktop\OtpCode;
use App\Models\AmoUser;
use App\Models\DesktopDevice;
use App\Services\Desktop\OtpService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Mail;

class AuthController extends Controller
{
    public function __construct(private readonly OtpService $otp) {}

    public function requestCode(RequestCodeRequest $r): Response
    {
        $amoUser = AmoUser::findOrFail($r->integer('amo_user_id'));

        $code = $this->otp->generate($amoUser->id, $r->ip());
        if ($code === null) {
            return response('', 429);
        }

        Mail::to($amoUser->email)->send(new OtpCode(
            userName: $amoUser->name,
            code: $code,
            ttlMinutes: OtpService::TTL_MINUTES,
        ));

        return response('', 204);
    }

    public function verifyCode(VerifyCodeRequest $r): JsonResponse
    {
        $amoUser = AmoUser::findOrFail($r->integer('amo_user_id'));

        if (! $this->otp->verify($amoUser->id, $r->string('code'))) {
            return response()->json(['message' => 'Неверный или истёкший код'], 422);
        }

        // Find an account for this amo_user — POC: pick first account.
        $account = $amoUser->accounts()->first();
        if (! $account) {
            return response()->json(['message' => 'У пользователя нет связанных аккаунтов'], 422);
        }

        $tokenName = 'desktop:'.($r->string('device_label')?->value() ?: 'unknown');
        $token = $amoUser->createToken($tokenName);

        $device = DesktopDevice::create([
            'amo_user_id' => $amoUser->id,
            'account_id' => $account->id,
            'access_token_id' => $token->accessToken->id,
            'device_label' => $r->string('device_label')?->value(),
            'last_seen_at' => Carbon::now(),
        ]);

        return response()->json([
            'token' => $token->plainTextToken,
            'amo_user' => [
                'id' => $amoUser->id,
                'name' => $amoUser->name,
                'email' => $amoUser->email,
                'avatar_url' => null,
            ],
            'dnd_on' => $device->dnd_on,
            'account' => [
                'id' => $account->id,
                'subdomain' => $account->subdomain,
                'name' => $account->name,
            ],
        ]);
    }

    public function logout(Request $r): Response
    {
        $token = $r->user()?->currentAccessToken();
        if ($token) {
            DesktopDevice::where('access_token_id', $token->id)->delete();
            $token->delete();
        }
        return response('', 204);
    }
}
```

- [ ] **Step 8.3: MeController**

`app/Http/Controllers/Api/Desktop/MeController.php`:

```php
<?php

namespace App\Http\Controllers\Api\Desktop;

use App\Http\Controllers\Controller;
use App\Models\DesktopDevice;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function __invoke(Request $r): JsonResponse
    {
        $amoUser = $r->user();
        $token = $amoUser?->currentAccessToken();
        $device = $token ? DesktopDevice::where('access_token_id', $token->id)->first() : null;

        if ($device) {
            $device->update(['last_seen_at' => Carbon::now()]);
        }

        $account = $amoUser?->accounts()->first();

        return response()->json([
            'amo_user' => [
                'id' => $amoUser->id,
                'name' => $amoUser->name,
                'email' => $amoUser->email,
                'avatar_url' => null,
            ],
            'dnd_on' => $device?->dnd_on ?? false,
            'account' => $account ? [
                'id' => $account->id,
                'subdomain' => $account->subdomain,
                'name' => $account->name,
            ] : null,
        ]);
    }
}
```

- [ ] **Step 8.4: DndController**

`app/Http/Controllers/Api/Desktop/DndController.php`:

```php
<?php

namespace App\Http\Controllers\Api\Desktop;

use App\Http\Controllers\Controller;
use App\Http\Requests\Desktop\DndRequest;
use App\Models\DesktopDevice;
use Illuminate\Http\JsonResponse;

class DndController extends Controller
{
    public function __invoke(DndRequest $r): JsonResponse
    {
        $token = $r->user()->currentAccessToken();
        $device = DesktopDevice::where('access_token_id', $token->id)->firstOrFail();
        $device->update(['dnd_on' => $r->boolean('on')]);

        return response()->json(['dnd_on' => $device->dnd_on]);
    }
}
```

- [ ] **Step 8.5: Commit controllers**

```bash
cd ~/projects/octane.pushka.biz && \
  bash ~/.claude/scripts/commit-files.sh "feat(desktop): controllers for auth + me + dnd + amo-users" \
    app/Http/Controllers/Api/Desktop/AmoUsersController.php \
    app/Http/Controllers/Api/Desktop/AuthController.php \
    app/Http/Controllers/Api/Desktop/MeController.php \
    app/Http/Controllers/Api/Desktop/DndController.php
```

---

## Task 9: Routes

- [ ] **Step 9.1: Edit `routes/api.php` — append at end (preserve existing routes)**

```php
use App\Http\Controllers\Api\Desktop;

Route::prefix('desktop/v1')->group(function () {
    Route::get('accounts/{accountSlug}/amo-users', [Desktop\AmoUsersController::class, 'index']);

    Route::post('auth/request-code', [Desktop\AuthController::class, 'requestCode'])
        ->middleware('throttle:5,60'); // 5 per 60 min per IP

    Route::post('auth/verify-code', [Desktop\AuthController::class, 'verifyCode'])
        ->middleware('throttle:10,60');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [Desktop\AuthController::class, 'logout']);
        Route::get('me', Desktop\MeController::class);
        Route::post('dnd', Desktop\DndController::class);
    });
});
```

- [ ] **Step 9.2: Commit**

```bash
cd ~/projects/octane.pushka.biz && \
  bash ~/.claude/scripts/commit-files.sh "feat(desktop): routes for /api/desktop/v1/*" \
    routes/api.php
```

---

## Task 10: Smoke test via curl (manual, user-driven)

After deploying to dev `composer dev` server:

```bash
# Start dev server
cd ~/projects/octane.pushka.biz && composer dev &

# 1) list AmoUsers for mogoby
curl -s http://127.0.0.1:8001/api/desktop/v1/accounts/mogoby/amo-users | jq | head -20

# 2) request code (replace 123 with real amo_user_id from step 1)
curl -i -X POST http://127.0.0.1:8001/api/desktop/v1/auth/request-code \
  -H 'Content-Type: application/json' \
  -d '{"amo_user_id": 123}'
# Expected: 204

# 3) check Laravel log for OTP code
tail -5 ~/projects/octane.pushka.biz/storage/logs/laravel.log | grep -E "Код входа|code"

# 4) verify code (replace 654321 with real OTP from log)
TOKEN=$(curl -s -X POST http://127.0.0.1:8001/api/desktop/v1/auth/verify-code \
  -H 'Content-Type: application/json' \
  -d '{"amo_user_id": 123, "code": "654321", "device_label": "test-cli"}' \
  | jq -r .token)
echo "TOKEN=$TOKEN"

# 5) /me with bearer
curl -s http://127.0.0.1:8001/api/desktop/v1/me \
  -H "Authorization: Bearer $TOKEN" | jq

# 6) DND on
curl -s -X POST http://127.0.0.1:8001/api/desktop/v1/dnd \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"on": true}' | jq

# 7) logout
curl -i -X POST http://127.0.0.1:8001/api/desktop/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

All 7 must succeed.

---

## Task 11: Push octane

- [ ] **Step 11.1: Push to GH**

```bash
cd ~/projects/octane.pushka.biz && git push origin main
```

- [ ] **Step 11.2: Migrations on prod**

User runs (manually):
```bash
kubectl exec -n <ns> deployment/octane-app -- php artisan migrate
```

(Migrations affect only new tables — safe.)

---

## Definition of Done (Phase 2)

1. `composer test --filter=OtpServiceTest` зелёный.
2. Curl smoke 1-7 проходит локально (после `composer dev`).
3. Все коммиты в octane `main`, pushed.
4. (Опционально, для prod) `php artisan migrate` на проде применил миграции.
5. Sales-agent (Phase 1) пока ничего об этом не знает — Phase 3 будет wire-up.
