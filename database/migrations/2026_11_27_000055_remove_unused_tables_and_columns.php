<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Tables nothing in Ronda reads or writes any more. Their create migrations were deleted. */
    private const TABLES = [
        'error_table',                 // Eciatto's mobile error log
        'agent_conversation_messages', // laravel/ai chat history, never used
        'agent_conversations',
        'rating',                      // task ratings: no screen ever saved one
        'reminders',                   // task reminders: no screen ever saved one
        'ife_status',                  // visit status list nobody read
        'nature_of_business',          // Eciatto business types nobody read
    ];

    private const DELETED_MIGRATIONS = [
        '2026_01_11_000001_create_agent_conversations_table',
        '2026_09_28_000004_create_error_table',
        '2026_09_28_000008_create_ife_status_table',
        '2026_09_28_000009_create_nature_of_business_table',
        '2026_09_28_000016_create_reminders_table',
        '2026_09_28_000017_create_rating_table',
    ];

    /** Columns written but never read, or used only by Telegram. */
    private const COLUMNS = [
        'users'                     => ['telegram_chat_id', 'last_login_date', 'email_verified_at'],
        'notifications'             => ['telegram_send_message_id', 'telegram_send_sticker_id'],
        'password_resets'           => ['mobile'],
        'leads'                     => ['hq_checker'],
        'ife_report'                => ['freeze'],
        'recipes'                   => ['created_by'],
        'area_rules'                => ['updated_by'],
        'menu_scans'                => ['confirmed_at'],
        'menu_scan_items'           => ['match_share'],
        'daily_digests'             => ['stats', 'model', 'input_tokens', 'output_tokens'],
        'outlet_briefs'             => ['model', 'input_tokens', 'output_tokens'],
        'form_submission_approvals' => ['assigned_by'],
        'general_settings'          => ['description'],
        'states'                    => ['code'],
    ];

    /** Columns with a foreign key to drop first. */
    private const FOREIGN_KEYS = [
        'leads'   => ['hq_checker'],
        'recipes' => ['created_by'],
    ];

    /** Settings rows nothing reads: Telegram's, and three only the seeder knew. */
    private const SETTINGS = [
        'telegram_api', 'telegram_api_webhook_url', 'simulate_telegram_message',
        'rating_closing_month', 'app_version', 'app_name',
    ];

    public function up()
    {
        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }

        foreach (self::COLUMNS as $table => $columns) {
            $present = array_values(array_filter($columns, fn ($column) => Schema::hasColumn($table, $column)));
            if ($present === []) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($table, $present) {
                foreach (self::FOREIGN_KEYS[$table] ?? [] as $column) {
                    if (in_array($column, $present, true)) {
                        $blueprint->dropForeign([$column]);
                    }
                }
                $blueprint->dropColumn($present);
            });
        }

        DB::table('general_settings')->whereIn('key', self::SETTINGS)->delete();
        DB::table('migrations')->whereIn('migration', self::DELETED_MIGRATIONS)->delete();
    }

    /** Puts the columns back, empty. The dropped tables, their rows and the settings rows are not restored. */
    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('telegram_chat_id', 50)->nullable()->index();
            $table->timestamp('email_verified_at')->nullable();
            $table->dateTime('last_login_date')->nullable();
        });
        Schema::table('notifications', function (Blueprint $table) {
            $table->integer('telegram_send_message_id')->nullable()->index();
            $table->string('telegram_send_sticker_id', 150)->nullable()->index();
        });
        Schema::table('password_resets', fn (Blueprint $table) => $table->string('mobile', 16)->nullable());
        Schema::table('leads', fn (Blueprint $table) => $table->foreignId('hq_checker')->nullable()->constrained('users'));
        Schema::table('ife_report', fn (Blueprint $table) => $table->char('freeze', 1)->default('N'));
        Schema::table('recipes', fn (Blueprint $table) => $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete());
        Schema::table('area_rules', fn (Blueprint $table) => $table->unsignedBigInteger('updated_by')->nullable());
        Schema::table('menu_scans', fn (Blueprint $table) => $table->dateTime('confirmed_at')->nullable());
        Schema::table('menu_scan_items', fn (Blueprint $table) => $table->decimal('match_share', 4, 3)->nullable());
        Schema::table('daily_digests', function (Blueprint $table) {
            $table->json('stats')->nullable();
            $table->string('model', 100)->nullable();
            $table->unsignedInteger('input_tokens')->nullable();
            $table->unsignedInteger('output_tokens')->nullable();
        });
        Schema::table('outlet_briefs', function (Blueprint $table) {
            $table->string('model', 100)->nullable();
            $table->unsignedInteger('input_tokens')->nullable();
            $table->unsignedInteger('output_tokens')->nullable();
        });
        Schema::table('form_submission_approvals', fn (Blueprint $table) => $table->unsignedBigInteger('assigned_by')->nullable());
        Schema::table('general_settings', fn (Blueprint $table) => $table->text('description')->nullable());
        Schema::table('states', fn (Blueprint $table) => $table->string('code', 5)->nullable());
    }
};
