<?php

namespace Database\Seeders;

use App\Models\States;
use Illuminate\Database\Seeder;

class StatesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        //
        $states = collect([
            [
                'name' => "Johor",
            ],
            [
                'name' => "Kedah",
            ],
            [
                'name' => "Kelantan",
            ],
            [
                'name' => "Melaka",
            ],
            [
                'name' => "Negeri Sembilan",
            ],
            [
                'name' => "Pahang",
            ],
            [
                'name' => "Penang",
            ],
            [
                'name' => "Perak",
            ],
            [
                'name' => "Perlis",
            ],
            [
                'name' => "Sabah",
            ],
            [
                'name' => "Sarawak",
            ],
            [
                'name' => "Selangor",
            ],
            [
                'name' => "Terengganu",
            ],
            [
                'name' => "Kuala Lumpur",
            ],
            [
                'name' => "WP Labuan",
            ],
            [
                'name' => "WP Putrajaya",
            ],
        ]);

        $states->each(function ($state) {
            States::firstOrCreate([
                'name' => $state['name'],
            ]);
        });
    }
}
