<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The district and its DOSM income group were only ever shown on the
     * outlet's Area card; nothing ranked on them. An outlet that had only a
     * district now simply has no area profile.
     */
    public function up()
    {
        DB::table('leads')->where('area_source', 'district_only')->update(['area_source' => 'none']);

        Schema::table('leads', function (Blueprint $table) {
            $table->dropColumn(['district', 'income_group']);
            $table->string('area_source', 20)->nullable()->comment('amazon | seeded | none')->change();
        });
    }

    public function down()
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->string('district', 60)->nullable()->after('is_halal');
            $table->string('income_group', 10)->nullable()->after('district')->comment('B40 | M40 | T20, from the district median');
            $table->string('area_source', 20)->nullable()->comment('seeded | district_only | none')->change();
        });
    }
};
