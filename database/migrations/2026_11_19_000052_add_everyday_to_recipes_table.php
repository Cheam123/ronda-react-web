<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Everyday drinks (Americano, Latte, Teh O…) are ones most outlets already
 * serve. They stay on the drinks list so menus can be matched against them,
 * but they become drink ideas only when a menu shows the outlet lacks them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->boolean('everyday')->default(false)->after('is_active')->comment('Most outlets already serve it: an idea only when a menu lacks it');
        });
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('everyday');
        });
    }
};
