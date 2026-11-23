<?php

namespace App\Services\Menu;

/** Reads the lines of text on menu photos, with where each line sits. */
interface PhotoReader
{
    /**
     * @param string[] $paths photo files, in order
     * @return array<int, array{text: string, page: int, x: int, y: int, width: int, height: int, group?: string}>
     *         one fragment per line; page is the photo's position, group the
     *         block of the layout the line belongs to when the reader knows it
     */
    public function read(array $paths): array;
}
