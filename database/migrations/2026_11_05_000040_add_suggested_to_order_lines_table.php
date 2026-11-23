<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Whether a line came from a suggestion, so orders can be traced back to the engine. */
    public function up()
    {
        Schema::table('order_lines', function (Blueprint $table) {
            $table->boolean('suggested')->default(false)->after('line_total');
        });
    }

    public function down()
    {
        Schema::table('order_lines', function (Blueprint $table) {
            $table->dropColumn('suggested');
        });
    }
};
