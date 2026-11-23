<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What kind of drink it is, and the other names a menu may use for it.
     * Both are what a scanned menu is matched against.
     */
    public function up()
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->json('aliases')->nullable()->after('slug')->comment('Other names a menu may use for this drink');
            $table->string('category', 30)->nullable()->after('aliases')->comment('One of Recipe::CATEGORIES');
        });
    }

    public function down()
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn(['aliases', 'category']);
        });
    }
};
