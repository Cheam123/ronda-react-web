<?php

namespace App\Services\Menu;

use RuntimeException;

/** Menu photos that couldn't be read, with a message the rep can act on. */
final class MenuPhotoError extends RuntimeException
{
}
