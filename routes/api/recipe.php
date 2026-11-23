<?php

use Illuminate\Support\Facades\Route;

Route::group(['middleware' => ['auth']], function () {

    Route::get('/', 'API\V1\RecipeController@index')->name('recipe.index');
    Route::get('/create', 'API\V1\RecipeController@create')->name('recipe.create');
    Route::post('/store', 'API\V1\RecipeController@store')->name('recipe.store');
    Route::get('/view/{id}', 'API\V1\RecipeController@view')->name('recipe.view');
    Route::get('/edit/{id}', 'API\V1\RecipeController@edit')->name('recipe.edit');
    Route::post('/activate/{id}', 'API\V1\RecipeController@activate')->name('recipe.activate');
    Route::post('/alias/{id}', 'API\V1\RecipeController@alias')->name('recipe.alias');
    Route::post('/ideas-check', 'API\V1\RecipeController@checkIdeas')->name('recipe.ideasCheck');
    Route::post('/update/{id}', 'API\V1\RecipeController@update')->name('recipe.update');
    Route::post('/delete', 'API\V1\RecipeController@delete')->name('recipe.delete');

    # Area rules: which drinks suit each area type around an outlet
    Route::get('/area-rules', 'API\V1\AreaRuleController@index')->name('recipe.areaRules');
    Route::post('/area-rules', 'API\V1\AreaRuleController@update')->name('recipe.areaRules.update');
});
