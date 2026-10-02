<?php

use Illuminate\Support\Facades\Route;

Route::group(['middleware' => ['auth']], function () {

    Route::get('/', 'API\V1\ProductController@index')->name('product.index');
    Route::get('/create', 'API\V1\ProductController@create')->name('product.create');
    Route::post('/store', 'API\V1\ProductController@store')->name('product.store');
    Route::get('/view/{id}', 'API\V1\ProductController@view')->name('product.view');
    Route::get('/edit/{id}', 'API\V1\ProductController@edit')->name('product.edit');
    Route::post('/activate/{id}', 'API\V1\ProductController@activate')->name('product.activate');
    Route::post('/update/{id}', 'API\V1\ProductController@update')->name('product.update');
    Route::post('/delete', 'API\V1\ProductController@delete')->name('product.delete');
});
