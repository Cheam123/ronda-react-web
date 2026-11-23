<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Whether a product is halal (a drink is halal only if all its ingredients
     * are), and how much of it a typical outlet uses in a month.
     */
    public function up()
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('is_halal')->nullable()->after('unit_price')->comment('null = not stated');
            $table->decimal('base_monthly_qty', 10, 2)->nullable()->after('is_halal')->comment('Typical monthly quantity for a 50-seat outlet');
        });
    }

    public function down()
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['is_halal', 'base_monthly_qty']);
        });
    }
};
