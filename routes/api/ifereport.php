<?php

use Illuminate\Support\Facades\Route;


Route::group(['middleware' => ['auth']], function () {
    Route::get('/','API\V1\IFEReportController@index')->name('ifereport.index');
    Route::get('/export', 'API\V1\IFEReportController@export')->name('ifereport.export');
    Route::get('/view', 'API\V1\IFEReportController@view')->name('ifereport.view');
    Route::post('/delete', 'API\V1\IFEReportController@delete')->name('ifereport.delete');
    Route::post('/convert', 'API\V1\IFEReportController@convet_to_task')->name('ifereport.convert');
});
