<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What reps did with a drink idea. Rows are only ever added: the newest row
     * per outlet and drink is its status, and the rest is the history.
     */
    public function up()
    {
        Schema::create('recommendation_feedback', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained('leads')->cascadeOnDelete();
            $table->foreignId('recipe_id')->constrained('recipes')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->string('status', 20)->comment('pitched | accepted | declined | cleared');
            $table->string('reason', 30)->nullable()
                ->comment('Why it was declined: too_expensive | has_supplier | not_on_menu | not_their_customers | other');
            $table->timestamps();

            $table->index(['lead_id', 'recipe_id', 'id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('recommendation_feedback');
    }
};
