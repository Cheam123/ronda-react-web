<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run()
    {
        $this->call([
            GeneralSettingSeeder::class,
            StatesSeeder::class,
            CitiesSeeder::class,
            UserSeeder::class,
            IfeAreaSeeder::class,
        ]);
    }
}
