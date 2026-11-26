
<?php

use Illuminate\Support\Facades\Route;


Route::group(['middleware' => ['auth']], function () {

    Route::get('/manage/index', 'API\V1\TaskController@index')->name('tasks.index');
    Route::get('/manage/index2', 'API\V1\TaskController@index2')->name('tasks.index2');
    Route::get('/manage/view/{id}', 'API\V1\TaskController@view')->name('tasks.view');
    Route::get('/manage/create', 'API\V1\TaskController@create')->name('tasks.create');
    Route::post('/manage/store', 'API\V1\TaskController@store')->name('tasks.store');
    Route::get('/manage/edit/{id}', 'API\V1\TaskController@edit')->name('tasks.edit');
    Route::post('/manage/update', 'API\V1\TaskController@update')->name('tasks.update');

    Route::post('/manage/reactivate', 'API\V1\TaskController@marked_as_inprogess')->name('tasks.reactivate');
    Route::post('/manage/delete', 'API\V1\TaskController@delete')->name('tasks.delete');

    Route::post('/manage/accept', 'API\V1\TaskController@marked_as_inprogress')->name('tasks.accept');
    Route::post('/manage/done', 'API\V1\TaskController@marked_as_done')->name('tasks.done');
    Route::post('/manage/verified', 'API\V1\TaskController@marked_as_verified')->name('tasks.verified');
    Route::post('/manage/fallback', 'API\V1\TaskController@marked_as_fallback')->name('tasks.fallback');
    Route::post('/manage/completed', 'API\V1\TaskController@marked_as_completed')->name('tasks.completed');
    Route::post('/manage/kiv', 'API\V1\TaskController@marked_as_kiv')->name('tasks.kiv');
    Route::post('/manage/rejected', 'API\V1\TaskController@marked_as_rejected')->name('tasks.rejected');
    Route::post('/manage/onhold', 'API\V1\TaskController@marked_as_onhold')->name('tasks.onhold');

    Route::post('/chat/store', 'API\V1\TaskController@chat_store')->name('chat.store');
    Route::post('/chat/update', 'API\V1\TaskController@chat_update')->name('chat.update');
    Route::post('/chat/delete', 'API\V1\TaskController@chat_delete')->name('chat.delete');

    Route::post('/chat/markedasread', 'API\V1\TaskController@chat_marked_as_read')->name('chat.markedasread');

    Route::get('/export-single-task', 'API\V1\TaskController@export_single_task')->name('tasks.export_single_task');
});
