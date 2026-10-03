<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tutorial extends Model
{
    protected $fillable = ['role', 'category', 'title', 'content', 'video_url', 'sort_order'];
}
