<?php

namespace Database\Seeders;

use App\Models\GeneralSetting;
use Illuminate\Database\Seeder;

class GeneralSettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $settings = [
            // Daily running number for task references (T-Ymd-0001), reset every night.
            'task_submit_cnt'        => '0',
            // The phone app's version and where to download it.
            'life_version'           => '1.0',
            'life_app_download_link' => 'https://youtube.com',
            // Oldest phone app version still allowed to run; below this the app must update.
            'min_version'            => '1.9.2',
        ];

        foreach ($settings as $key => $value) {
            GeneralSetting::firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
