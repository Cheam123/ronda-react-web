<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What is known about where an outlet trades, written by AreaProfiler,
     * plus whether it only stocks halal products.
     */
    public function up()
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->boolean('is_halal')->nullable()->after('segment')->comment('Only stocks halal products; null = not stated');
            $table->string('district', 60)->nullable()->after('is_halal');
            $table->string('income_group', 10)->nullable()->after('district')->comment('B40 | M40 | T20, from the district median');
            $table->json('area_types')->nullable()->after('income_group');
            $table->json('nearby_counts')->nullable()->after('area_types')->comment('Nearby place category => count');
            $table->string('area_source', 20)->nullable()->after('nearby_counts')->comment('seeded | district_only | none');
            $table->dateTime('area_profiled_at')->nullable()->after('area_source');
        });
    }

    public function down()
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropColumn(['is_halal', 'district', 'income_group', 'area_types', 'nearby_counts', 'area_source', 'area_profiled_at']);
        });
    }
};
