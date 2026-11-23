<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The weighted area scores behind an outlet's area types, the evidence for
     * each, the cafes and restaurants nearby and the nearest places, as
     * AreaProfiler::details() writes them.
     */
    public function up()
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->json('area_details')->nullable()->after('nearby_counts')->comment('Area scores, evidence, competition and nearest places');
        });
    }

    public function down()
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropColumn('area_details');
        });
    }
};
