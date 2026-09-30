<?php

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

# No self sign-up: accounts are created by an admin (Users > Create). Public
# registration made an active Field Rep account for anyone who found /register.
Auth::routes(['register' => false]);

# Legal pages — public on purpose. The Play Console fetches the privacy policy
# and account deletion URLs without signing in, so these must stay unauthenticated
# (LegalController declares no auth middleware).
Route::get('/privacy', [App\Http\Controllers\LegalController::class, 'privacy'])->name('legal.privacy');
Route::get('/terms', [App\Http\Controllers\LegalController::class, 'terms'])->name('legal.terms');
Route::get('/account-deletion', [App\Http\Controllers\LegalController::class, 'accountDeletion'])->name('legal.accountDeletion');
Route::post('/account-deletion', [App\Http\Controllers\LegalController::class, 'submitAccountDeletion'])
    ->middleware('throttle:5,60')
    ->name('legal.accountDeletion.submit');

Route::get('/', [App\Http\Controllers\HomeController::class, 'root']);
Route::get('/index', [App\Http\Controllers\HomeController::class, 'index']);
Route::post('/index/digest', [App\Http\Controllers\HomeController::class, 'regenerateDigest'])
    ->middleware('throttle:6,1')
    ->name('dashboard.digest');

Route::group(['prefix' => 'v1'], function () {

    Route::get('/state/{state}/cities', 'API\V1\StatesController@getCities')->name('directories.state');

    # User Group
    Route::prefix('users')->group(__DIR__ . '/api/users.php');

    # Telegram Setting Group
    Route::prefix('setting')->group(__DIR__ . '/api/setting.php');

    # Task Group
    Route::prefix('task')->group(__DIR__ . '/api/task.php');

    # Lead Group
    Route::prefix('lead')->group(__DIR__ . '/api/leads.php');

    # IFE Report Group
    Route::prefix('ifereport')->group(__DIR__ . '/api/ifereport.php');

    # Task Reminder Group
    Route::prefix('reminder')->group(__DIR__ . '/api/reminder.php');

    # Task Rating Group
    Route::prefix('rating')->group(__DIR__ . '/api/rating.php');

    # Form Group
    Route::prefix('form')->group(__DIR__ . '/api/form.php');

    # Product Catalogue Group
    Route::prefix('product')->group(__DIR__ . '/api/product.php');

    # IFE Area Group
    Route::prefix('area')->group(__DIR__ . '/api/area.php');
});