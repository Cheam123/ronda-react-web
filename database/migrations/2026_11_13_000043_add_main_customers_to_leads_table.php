<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Who the rep says the outlet mostly serves. When set it takes the place of
     * the customer groups worked out from nearby places.
     */
    public function up()
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->json('main_customers')->nullable()->after('area_types')
                ->comment('Area kinds from ife.recommendation.customer_groups, picked by the rep');
        });
    }

    public function down()
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropColumn('main_customers');
        });
    }
};
