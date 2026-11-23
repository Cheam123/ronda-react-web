<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What the outlet needs, as the rep hears it from the owner: the drinks
     * that sell best, what they want to improve, and what a drink usually
     * costs there. Main customers already has its own column.
     */
    public function up()
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->json('best_selling_kinds')->nullable()->after('main_customers')
                ->comment('Drink kinds from Recipe::CATEGORIES that sell best');
            $table->json('improvement_goals')->nullable()->after('best_selling_kinds')
                ->comment('Goals from Leads::GOALS');
            $table->decimal('typical_drink_price', 6, 2)->nullable()->after('improvement_goals')
                ->comment('What a usual drink costs there, in RM');
        });
    }

    public function down()
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropColumn(['best_selling_kinds', 'improvement_goals', 'typical_drink_price']);
        });
    }
};
