<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Claude is now called through the Claude API by default, not only Bedrock,
 * so a digest or visit brief that Claude wrote is marked `claude` instead of
 * `bedrock`.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('daily_digests')->where('source', 'bedrock')->update(['source' => 'claude']);
        DB::table('outlet_briefs')->where('source', 'bedrock')->update(['source' => 'claude']);

        Schema::table('daily_digests', function (Blueprint $table) {
            $table->string('source', 20)->default('template')->comment('claude | template')->change();
        });
        Schema::table('outlet_briefs', function (Blueprint $table) {
            $table->string('source', 20)->comment('claude | template')->change();
        });
    }

    public function down(): void
    {
        DB::table('daily_digests')->where('source', 'claude')->update(['source' => 'bedrock']);
        DB::table('outlet_briefs')->where('source', 'claude')->update(['source' => 'bedrock']);

        Schema::table('daily_digests', function (Blueprint $table) {
            $table->string('source', 20)->default('template')->comment('bedrock | template')->change();
        });
        Schema::table('outlet_briefs', function (Blueprint $table) {
            $table->string('source', 20)->comment('bedrock | template')->change();
        });
    }
};
