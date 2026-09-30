<?php

namespace App\Http\Resources\Tasks;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * One follow-up on a task's activity timeline.
 *
 * @mixin \App\Models\TaskComment
 */
class TaskCommentResource extends JsonResource
{
    /** A comment can be edited or deleted this long after it was sent. */
    private const EDIT_WINDOW_MINUTES = 15;

    public function toArray($request): array
    {
        $user    = $request->user();
        $created = Carbon::parse($this->created_at);
        $message = $this->message ?? '';

        return [
            'id'          => $this->id,
            'author'      => optional($this->submitBy)->name ?: 'User',
            'mine'        => $user && $this->submit_by == $user->id,
            'created_at'  => $created->format('d/m/y · h:i A'),
            'created_iso' => $created->toIso8601String(),
            'can_modify'  => $user
                && $this->submit_by == $user->id
                && $created->diffInMinutes(Carbon::now()) <= self::EDIT_WINDOW_MINUTES,
            // The raw text for the edit box, and the stored HTML to display.
            'message'     => $message,
            'html'        => trim(strip_tags($message)) !== '' || str_contains($message, '<img') ? $this->formated_message : null,
            'attachments' => $this->documentUploads->map(fn ($document) => [
                'id'       => $document->id,
                'filename' => $document->filename,
                'name'     => $document->display_name,
                'url'      => route('lead.file.download', ['doc_id' => $document->id]),
            ])->values()->all(),
            // Photos of the IFE report a converted visit posted as this comment.
            'report_photos' => $this->ife_report_id && $this->ifeReport
                ? $this->ifeReport->documentUploads->map(fn ($document) => [
                    'id'       => $document->id,
                    'filename' => $document->filename,
                    'name'     => $document->filename,
                    'url'      => $document->file_full_path,
                ])->values()->all()
                : [],
        ];
    }
}
