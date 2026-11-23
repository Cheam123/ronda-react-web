<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Staff logins for the viva database: the same people and logins as
 * DemoDataSeeder, without its outlets and orders. The generated outlets
 * there belong to these reps. Development and demo databases only.
 *     php artisan db:seed --class=VivaStaffSeeder
 */
class VivaStaffSeeder extends Seeder
{
    private const PASSWORD = '12345678';

    public function run()
    {
        $people = [
            // For the Admin pages (products, drinks) in the demo, without using a real admin's account.
            ['admin@demo.test', 'Nurul Huda', User::TYPE_ADMIN, 'F', '60120000000'],
            ['manager@demo.test', 'Mei Ling Tan', User::TYPE_MANAGER, 'F', '60120000001'],
            ['rep1@demo.test', 'Aiman Rahman', User::TYPE_USER, 'M', '60120000002'],
            ['rep2@demo.test', 'Priya Nair', User::TYPE_USER, 'F', '60120000003'],
            ['rep3@demo.test', 'Jason Lim', User::TYPE_USER, 'M', '60120000004'],
        ];

        foreach ($people as [$email, $name, $type, $gender, $mobile]) {
            // Without events: the UserCreated listener would replace the password.
            $user = User::withoutEvents(fn () => User::firstOrCreate(['email' => $email], [
                'name'     => $name,
                'type'     => $type,
                'status'   => 1,
                'gender'   => $gender,
                'mobile'   => $mobile,
                'password' => Hash::make(self::PASSWORD),
            ]));

            if (!$user->username) {
                $user->username = sprintf('U%05d', $user->id);
                $user->save();
            }
        }
    }
}
