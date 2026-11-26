<?php

namespace App\Helpers;

use App\Models\Tasks;
use App\Models\User;
use App\Models\States;
use App\Models\Cities;
use App\Models\Leads;
use App\Models\IfeArea;
use Carbon\Carbon;

use Illuminate\Support\Facades\Auth;

class Helper
{
    public static function getBusinessCategoryListing()
    {
        return [
            1 => 'Bar/Pub/Bistro',
            2 => 'Cafe',
            3 => 'Hotel',
            4 => 'Office',
            5 => 'Restaurant',
            6 => 'Truck',
            7 => 'Bakery',
            8 => 'Agent',
            9 => 'Cafe & Restaurant',
            10 => 'Event/Exhibition',
            11 => 'Home/End User',
            12 => 'Importer',
            13 => 'Institution',
            14 => 'Kiosk',
            15 => 'Partner',
            92 => 'Stockist',
            93 => 'Retail',
            94 => 'Dealer',
            95 => 'Distributor',
            96 => 'Wholesaler',
            97 => 'Local Chain',
            98 => 'International Chain',
            99 => 'Other',
        ];
    }

    public static function getBusinessCategoryListingForMobile()
    {
        return [
            [
                'value'   => 1,
                'label'   => 'Bar/Pub/Bistro'
            ],
            [
                'value'   => 2,
                'label'   => 'Cafe'
            ],
            [
                'value'   => 3,
                'label'   => 'Hotel'
            ],
            [
                'value'   => 4,
                'label'   => 'Office'
            ],
            [
                'value'   => 5,
                'label'   => 'Restaurant'
            ],
            [
                'value'   => 6,
                'label'   => 'Truck'
            ],
            [
                'value'   => 7,
                'label'   => 'Bakery'
            ],
            [
                'value'   => 8,
                'label'   => 'Agent'
            ],
            [
                'value'   => 9,
                'label'   => 'Cafe & Restaurant'
            ],
            [
                'value'   => 10,
                'label'   => 'Event/Exhibition'
            ],
            [
                'value'   => 11,
                'label'   => 'Home/End User'
            ],
            [
                'value'   => 12,
                'label'   => 'Importer'
            ],
            [
                'value'   => 13,
                'label'   => 'Institution'
            ],
            [
                'value'   => 14,
                'label'   => 'Kiosk'
            ],
            [
                'value'   => 15,
                'label'   => 'Partner'
            ],
            [
                'value'   => 92,
                'label'   => 'Stockist'
            ],
            [
                'value'   => 93,
                'label'   => 'Retail'
            ],
            [
                'value'   => 94,
                'label'   => 'Dealer'
            ],
            [
                'value'   => 95,
                'label'   => 'Distributor'
            ],
            [
                'value'   => 96,
                'label'   => 'Wholesaler'
            ],
            [
                'value'   => 97,
                'label'   => 'Local Chain'
            ],
            [
                'value'   => 98,
                'label'   => 'International Chain'
            ],
            [
                'value'   => 99,
                'label'   => 'Other'
            ]
        ];
    }

    public static function getBusinessCategory($type)
    {
        switch ($type) {
            case 1: return 'Bar/Pub/Bistro'; break;
            case 2: return 'Cafe'; break;
            case 3: return 'Hotel'; break;
            case 4: return 'Office'; break;
            case 5: return 'Restaurant'; break;
            case 6: return 'Truck'; break;
            case 7: return 'Bakery'; break;
            case 8: return 'Agent'; break;
            case 9: return 'Cafe & Restaurant'; break;
            case 10: return 'Event/Exhibition'; break;
            case 11: return 'Home/End User'; break;
            case 12: return 'Importer'; break;
            case 13: return 'Institution'; break;
            case 14: return 'Kiosk'; break;
            case 15: return 'Partner'; break;
            case 92: return 'Stockist'; break;
            case 93: return 'Retail'; break;
            case 94: return 'Dealer'; break;
            case 95: return 'Distributor'; break;
            case 96: return 'Wholesaler'; break;
            case 97: return 'Local Chain'; break;
            case 98: return 'International Chain'; break;
            case 99: return 'Other'; break;
        }
    }

    public static function getLeadSourceListing()
    {
        return [
            1 => 'Facebook',
            2 => 'Instagram',
            3 => 'Whatsapp',
            4 => 'Xiaohongshu',
            5 => 'ICBS',
            6 => 'Outsource Marketing',
            7 => 'Rise Acedemy',
            8 => 'Trio Cafe',
            9 => 'Inhouse Marketing',
            10 => 'FHM',
            99 => 'Other',
        ];
    }

    public static function getLeadSourceListingForMobile(){
        return [
            [
                'value'   => 1,
                'label'   => 'Facebook'
            ],
            [
                'value'   => 2,
                'label'   => 'Instagram'
            ],
            [
                'value'   => 3,
                'label'   => 'Whatsapp'
            ],
            [
                'value'   => 4,
                'label'   => 'Xiaohongshu'
            ],
            [
                'value'   => 5,
                'label'   => 'ICBS'
            ],
            [
                'value'   => 6,
                'label'   => 'Outsource Marketing'
            ],
            [
                'value'   => 7,
                'label'   => 'Rise Acedemy'
            ],
            [
                'value'   => 8,
                'label'   => 'Trio Cafe'
            ],
            [
                'value'   => 9,
                'label'   => 'Inhouse Marketing'
            ],
            [
                'value'   => 10,
                'label'   => 'FHM'
            ],
            [
                'value'   => 99,
                'label'   => 'Other'
            ]
        ];
    }

    public static function getLeadSource($type)
    {
        switch ($type) {
            case 1: return 'Facebook'; break;
            case 2: return 'Instagram'; break;
            case 3: return 'Whatsapp'; break;
            case 4: return 'Xiaohongshu'; break;
            case 5: return 'ICBS'; break;
            case 6: return 'Outsource Marketing'; break;
            case 7: return 'Rise Acedemy'; break;
            case 8: return 'Trio Cafe'; break;
            case 9: return 'Inhouse Marketing'; break;
            case 10: return 'FHM'; break;
            case 99: return 'Other'; break;
        }
    }

    public static function getTeamListing()
    {
        return [
            1 => 'Admin',
            2 => 'Operation',
            3 => 'Technician',
            4 => 'Marketing',
            5 => 'Sales',
            6 => 'Pre-Sales',
            99 => 'Manager',
        ];
    }

    public static function getTeam($type)
    {
        switch ($type) {
            case 1: return 'Admin'; break;
            case 2: return 'Operation'; break;
            case 3: return 'Technician'; break;
            case 4: return 'Marketing'; break;
            case 5: return 'Sales'; break;
            case 6: return 'Pre-Sales'; break;
            case 99: return 'Manager'; break;
            default: return ''; break;
        }
    }

    public static function getGender($type)
    {
        switch ($type) {
            case 'M': return trans('translation.male'); break;
            case 'F': return trans('translation.female'); break;
        }
    }

    public static function getStatus($type)
    {
        switch ($type) {
            case '0':  return ''; break;
            case '1':  return 'New Task'; break;
            case '2':  return 'In Progress'; break;
            case '3':  return 'Done'; break;
            case '4':  return 'Verified'; break;
            case '5':  return 'Completed'; break;
            case '6':  return 'KIV'; break;
            case '7':  return 'Rejected'; break;
            case '8':  return 'On Hold'; break;
        }
    }

    public static function getState($type)
    {
        if (empty($type)) {
            return '';
        } else {
            return States::findOrFail($type)->name;
        }
    }

    public static function getCity($type)
    {
        if (empty($type)) {
            return '';
        } else {
            return Cities::findOrFail($type)->name;
        }
    }

    public static function reformat_mobile($mobile)
    {
        if (empty($mobile)) {
            return NULL;
        }

        $c_mobile = substr($mobile, 0, 3);

        if ($c_mobile == '600') {
            $formated_mobile = substr($mobile, 2);

        } elseif ($c_mobile == '601' || 
                  $c_mobile == '602' || 
                  $c_mobile == '603' || 
                  $c_mobile == '604' || 
                  $c_mobile == '605' || 
                  $c_mobile == '606' || 
                  $c_mobile == '607' || 
                  $c_mobile == '608' || 
                  $c_mobile == '609' ) {
            $formated_mobile = substr($mobile, 1);
        
        } else {

            $c_mobile = substr($mobile, 0, 1);

            if ($c_mobile != '0') {
                $mobile = '0' . $mobile;
            }

            $formated_mobile = $mobile;
        }

        return $formated_mobile;
    }

    public static function prepareDataForSerialize(Tasks $b_task, Tasks $a_task)
    {
        // BEFORE;
        if (isset($b_task->id)) {
            $b_data['status']               = self::getStatus($b_task->status);
            $b_data['task_reference']       = isset($b_task->task_reference)        ? $b_task->task_reference : '';
            $b_data['appointment_date']     = isset($b_task->appointment_date)      ? Carbon::parse($b_task->appointment_date)->format('Y-m-d H:i:s') : '';
            $b_data['remark']               = isset($b_task->remark)                ? $b_task->remark : '';
            $b_data['start_date']           = isset($b_task->start_date)            ? Carbon::parse($b_task->start_date)->format('Y-m-d') : '';
            $b_data['start_time']           = isset($b_task->start_time)            ? $b_task->start_time : '';
            $b_data['due_date']             = isset($b_task->due_date)              ? Carbon::parse($b_task->due_date)->format('Y-m-d') : '';
            $b_data['due_time']             = isset($b_task->due_time)              ? Carbon::parse($b_task->due_time)->format('H:i:s') : '';
            $b_data['creation_date']        = isset($b_task->creation_date)         ? Carbon::parse($b_task->creation_date)->format('Y-m-d H:i:s') : '';
            $b_data['inprogress_date']      = isset($b_task->inprogress_date)       ? Carbon::parse($b_task->inprogress_date)->format('Y-m-d H:i:s') : '';
            $b_data['done_date']            = isset($b_task->done_date)             ? Carbon::parse($b_task->done_date)->format('Y-m-d H:i:s') : '';
            $b_data['verify_date']          = isset($b_task->verify_date)           ? Carbon::parse($b_task->verify_date)->format('Y-m-d H:i:s') : '';
            $b_data['complete_date']        = isset($b_task->complete_date)         ? Carbon::parse($b_task->complete_date)->format('Y-m-d H:i:s') : '';
            $b_data['reject_date']          = isset($b_task->reject_date)           ? Carbon::parse($b_task->reject_date)->format('Y-m-d H:i:s') : '';
            $b_data['kiv_date']             = isset($b_task->kiv_date)              ? Carbon::parse($b_task->kiv_date)->format('Y-m-d H:i:s') : '';
            $b_data['onhold_date']          = isset($b_task->onhold_date)           ? Carbon::parse($b_task->onhold_date)->format('Y-m-d H:i:s') : '';
            $b_data['lead_assignee']        = isset($b_task->lead->assign_to)       ? $b_task->lead->assignee->name : '';
        } else {
            $b_data['status']               = self::getStatus(0);
            $b_data['task_reference']       = '';
            $b_data['appointment_date']     = '';
            $b_data['remark']               = '';
            $b_data['start_date']           = '';
            $b_data['start_time']           = '';
            $b_data['due_date']             = '';
            $b_data['due_time']             = '';
            $b_data['creation_date']        = '';
            $b_data['inprogress_date']      = '';
            $b_data['done_date']            = '';
            $b_data['verify_date']          = '';
            $b_data['complete_date']        = '';
            $b_data['reject_date']          = '';
            $b_data['kiv_date']             = '';
            $b_data['onhold_date']          = '';
            $b_data['lead_assignee']        = '';
        }

        // AFTER;
        $a_data['status']               = self::getStatus($a_task->status);
        $a_data['task_reference']       = isset($a_task->task_reference)        ? $a_task->task_reference : '';
        $a_data['appointment_date']     = isset($a_task->appointment_date)      ? Carbon::parse($a_task->appointment_date)->format('Y-m-d H:i:s') : '';
        $a_data['remark']               = isset($a_task->remark)                ? $a_task->remark : '';
        $a_data['start_date']           = isset($a_task->start_date)            ? Carbon::parse($a_task->start_date)->format('Y-m-d') : '';
        $a_data['start_time']           = isset($a_task->start_time)            ? $a_task->start_time : '';
        $a_data['due_date']             = isset($a_task->due_date)              ? Carbon::parse($a_task->due_date)->format('Y-m-d') : '';
        $a_data['due_time']             = isset($a_task->due_time)              ? Carbon::parse($a_task->due_time)->format('H:i:s') : '';
        $a_data['creation_date']        = isset($a_task->creation_date)         ? Carbon::parse($a_task->creation_date)->format('Y-m-d H:i:s') : '';
        $a_data['inprogress_date']      = isset($a_task->inprogress_date)       ? Carbon::parse($a_task->inprogress_date)->format('Y-m-d H:i:s') : '';
        $a_data['done_date']            = isset($a_task->done_date)             ? Carbon::parse($a_task->done_date)->format('Y-m-d H:i:s') : '';
        $a_data['verify_date']          = isset($a_task->verify_date)           ? Carbon::parse($a_task->verify_date)->format('Y-m-d H:i:s') : '';
        $a_data['complete_date']        = isset($a_task->complete_date)         ? Carbon::parse($a_task->complete_date)->format('Y-m-d H:i:s') : '';
        $a_data['reject_date']          = isset($a_task->reject_date)           ? Carbon::parse($a_task->reject_date)->format('Y-m-d H:i:s') : '';
        $a_data['kiv_date']             = isset($a_task->kiv_date)              ? Carbon::parse($a_task->kiv_date)->format('Y-m-d H:i:s') : '';
        $a_data['onhold_date']          = isset($a_task->onhold_date)           ? Carbon::parse($a_task->onhold_date)->format('Y-m-d H:i:s') : '';
        $a_data['lead_assignee']        = isset($a_task->lead->assign_to)       ? $a_task->lead->assignee->name : '';

        // COMPARE
        $BEFORE = [];
        $AFTER  = [];

        if ($a_data['status'] != $b_data['status']) {
            $BEFORE['status'] = $b_data['status'];
            $AFTER['status']  = $a_data['status'];
        }
        if ($a_data['task_reference'] != $b_data['task_reference']) {
            $BEFORE['task_reference'] = $b_data['task_reference'];
            $AFTER['task_reference']  = $a_data['task_reference'];
        }
        if ($a_data['appointment_date'] != $b_data['appointment_date']) {
            $BEFORE['appointment_date'] = $b_data['appointment_date'];
            $AFTER['appointment_date']  = $a_data['appointment_date'];
        }
        if ($a_data['remark'] != $b_data['remark']) {
            $BEFORE['remark'] = $b_data['remark'];
            $AFTER['remark']  = $a_data['remark'];
        }
        if ($a_data['start_date'] != $b_data['start_date']) {
            $BEFORE['start_date'] = $b_data['start_date'];
            $AFTER['start_date']  = $a_data['start_date'];
        }
        if ($a_data['start_time'] != $b_data['start_time']) {
            $BEFORE['start_time'] = $b_data['start_time'];
            $AFTER['start_time']  = $a_data['start_time'];
        }
        if ($a_data['due_date'] != $b_data['due_date']) {
            $BEFORE['due_date'] = $b_data['due_date'];
            $AFTER['due_date']  = $a_data['due_date'];
        }
        if ($a_data['due_time'] != $b_data['due_time']) {
            $BEFORE['due_time'] = $b_data['due_time'];
            $AFTER['due_time']  = $a_data['due_time'];
        }
        if ($a_data['creation_date'] != $b_data['creation_date']) {
            $BEFORE['creation_date'] = $b_data['creation_date'];
            $AFTER['creation_date']  = $a_data['creation_date'];
        }
        if ($a_data['inprogress_date'] != $b_data['inprogress_date']) {
            $BEFORE['inprogress_date'] = $b_data['inprogress_date'];
            $AFTER['inprogress_date']  = $a_data['inprogress_date'];
        }
        if ($a_data['done_date'] != $b_data['done_date']) {
            $BEFORE['done_date'] = $b_data['done_date'];
            $AFTER['done_date']  = $a_data['done_date'];
        }
        if ($a_data['verify_date'] != $b_data['verify_date']) {
            $BEFORE['verify_date'] = $b_data['verify_date'];
            $AFTER['verify_date']  = $a_data['verify_date'];
        }
        if ($a_data['complete_date'] != $b_data['complete_date']) {
            $BEFORE['complete_date'] = $b_data['complete_date'];
            $AFTER['complete_date']  = $a_data['complete_date'];
        }
        if ($a_data['reject_date'] != $b_data['reject_date']) {
            $BEFORE['reject_date'] = $b_data['reject_date'];
            $AFTER['reject_date']  = $a_data['reject_date'];
        }
        if ($a_data['kiv_date'] != $b_data['kiv_date']) {
            $BEFORE['kiv_date'] = $b_data['kiv_date'];
            $AFTER['kiv_date']  = $a_data['kiv_date'];
        }
        if ($a_data['onhold_date'] != $b_data['onhold_date']) {
            $BEFORE['onhold_date'] = $b_data['onhold_date'];
            $AFTER['onhold_date']  = $a_data['onhold_date'];
        }
        if ($a_data['lead_assignee'] != $b_data['lead_assignee']) {
            $BEFORE['lead_assignee'] = $b_data['lead_assignee'];
            $AFTER['lead_assignee']  = $a_data['lead_assignee'];
        }
        
        $data['before'] = $BEFORE;
        $data['after']  = $AFTER;

        return $data;
    }

    public static function formatForDropdown($collection, string $valueColumn, string $labelColumn): array
    {
        // Return an empty array if the collection is null or empty to prevent errors.
        if (!$collection) {
            return [];
        }

        return $collection->map(function ($item) use ($valueColumn, $labelColumn) {
            $attributes = $item->toArray();

            $attributes['value'] = data_get($item, $valueColumn);
            $attributes['label'] = data_get($item, $labelColumn);

            return $attributes;
        })->values()->all();
    }

    public static function map_document_uploads($uploads)
    {
        return $uploads->map(function ($upload) {
            return [
                'id'            => $upload->id,
                'name'          => $upload->filename,
                'size'          => $upload->size,
                'file_path'     => $upload->getFileFullPathAttribute(),
                'uploaded_by'   => User::find($upload->upload_by)->name ?? 'Unknown',
                'created_at'    => $upload->created_at->toDateTimeString(),
                'file_type'     => strtolower(pathinfo($upload->filename, PATHINFO_EXTENSION)),
                'mime_type'     => $upload->mime_type,
            ];
        })->toArray();
    }

    public static function media_documents_array($uploads)
    {
        $mediaExtensions = [
            // Images
            'jpg',
            'jpeg',
            'png',
            'gif',
            'bmp',
            'webp',
            'svg',
            // Videos
            'mp4',
            'mov',
            'avi',
            'wmv',
            'mkv',
            'webm'
        ];

        $data = [];
        $mapUpload = function ($upload) {
            return [
                'id'            => $upload->id,
                'name'          => $upload->filename,
                'size'          => $upload->size,
                'file_path'     => $upload->getFileFullPathAttribute(),
                'uploaded_by'   => User::find($upload->upload_by)->name ?? 'Unknown',
                'created_at'    => $upload->created_at->toDateTimeString(),
                'file_type'     => strtolower(pathinfo($upload->filename, PATHINFO_EXTENSION)),
                'mime_type'     => $upload->mime_type,
            ];
        };

        // MEDIA
        $data['media'] = $uploads->filter(function ($upload) use ($mediaExtensions) {
            $extension = strtolower(pathinfo($upload->filename, PATHINFO_EXTENSION));
            return in_array($extension, $mediaExtensions);
        })->map($mapUpload)->values()->all();

        // DOCUMENTS
        $data['documents'] = $uploads->filter(function ($upload) use ($mediaExtensions) {
            $extension = strtolower(pathinfo($upload->filename, PATHINFO_EXTENSION));
            return !in_array($extension, $mediaExtensions);
        })->map($mapUpload)->values()->all();

        return $data;
    }

    public static function generateIfeReportHTML($ifeReport, $includeFiles = true, $includeTaskInfo = true)
    {
        $html  = '<div style="padding: 1px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; color: #333; line-height: 1;">';

        $html .= '  <!-- Report Summary Section -->
                    <div style="border: 1px solid #E5E5EA; margin-bottom: 10px; border-radius: 12px; overflow: hidden;">
                        <div style="background-color: #F2F2F7; padding: 14px; border-bottom: 1px solid #E5E5EA;">
                            <strong style="color: #1C1C1E; font-size: 12px;">📊 Report Summary</strong>
                        </div>
                        <div style="padding: 10px;">
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Created On:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . $ifeReport->created_at->format('M j, Y g:i A') . '</div>
                            </div>
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Last Updated:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . $ifeReport->updated_at->format('M j, Y g:i A') . '</div>
                            </div>
                        </div>
                    </div>
                    <div style="border: 1px solid #E5E5EA; margin-bottom: 10px; border-radius: 12px; overflow: hidden;">
                        <div style="background-color: #F2F2F7; padding: 14px; border-bottom: 1px solid #E5E5EA;">
                            <strong style="color: #1C1C1E; font-size: 12px;">📋 Task Information</strong>
                        </div>
                        <div style="padding: 10px;">
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Task Title:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . htmlspecialchars($ifeReport->task->title ?? 'N/A') . '</div>
                            </div>
                        </div>
                    </div>';

        $html .= '  <!-- Company Information -->
                    <div style="border: 1px solid #E5E5EA; margin-bottom: 10px; border-radius: 12px; overflow: hidden;">
                        <div style="background-color: #F2F2F7; padding: 14px; border-bottom: 1px solid #E5E5EA;">
                            <strong style="color: #1C1C1E; font-size: 12px;">🏢 Company Information</strong>
                        </div>
                        <div style="padding: 10px;">
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Company Name:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . ($ifeReport->company_name ?: '<em style="color: #8E8E93;">Not specified</em>') . '</div>
                            </div>
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Nature of Business:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . htmlspecialchars($ifeReport->nature_of_business ?? 'N/A') . '</div>
                            </div>
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Status:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . htmlspecialchars($ifeReport->status ?? 'N/A') . '</div>
                            </div>
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Cafe/Outlet/Shop Name:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . htmlspecialchars($ifeReport->shop_name ?? 'N/A') . '</div>
                            </div>
                        </div>
                    </div>';

        $html .= '  <!-- Location & Area Section -->
                    <div style="border: 1px solid #E5E5EA; margin-bottom: 10px; border-radius: 12px; overflow: hidden;">
                        <div style="background-color: #F2F2F7; padding: 14px; border-bottom: 1px solid #E5E5EA;">
                            <strong style="color: #1C1C1E; font-size: 12px;">📍 Location & Area</strong>
                        </div>
                        <div style="padding: 10px;">
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">IFE Area:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . htmlspecialchars(IfeArea::find($ifeReport->ife_area)->area ?? null) . '</div>
                            </div>
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Location:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . htmlspecialchars($ifeReport->location) . '</div>
                            </div>
                        </div>
                    </div>';

        $html .= '  <!-- Technical Details Section -->
                    <div style="border: 1px solid #E5E5EA; margin-bottom: 10px; border-radius: 12px; overflow: hidden;">
                        <div style="background-color: #F2F2F7; padding: 14px; border-bottom: 1px solid #E5E5EA;">
                            <strong style="color: #1C1C1E; font-size: 12px;">🔧 Technical Details</strong>
                        </div>
                        <div style="padding: 10px;">
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Problem:</span></u></div>
                                <div style="color: #1C1C1E; font-weight: 500; line-height: 1.6; padding-left: 8pt;">' . nl2br(htmlspecialchars($ifeReport->problem_description ?? 'N/A')) . '</div>
                            </div>
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Require Support:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . htmlspecialchars($ifeReport->support_required ?? 'N/A') . '</div>
                            </div>
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Support Detail:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . nl2br(htmlspecialchars($ifeReport->support_description ?? 'N/A')) . '</div>
                            </div>
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Advise/Suggestion/Opportunity:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . nl2br(htmlspecialchars($ifeReport->personal_remarks ?? 'N/A')) . '</div>
                            </div>
                        </div>
                    </div>';

        $html .= '  <!-- Contact Information -->
                    <div style="border: 1px solid #E5E5EA; margin-bottom: 10px; border-radius: 12px; overflow: hidden;">
                        <div style="background-color: #F2F2F7; padding: 14px; border-bottom: 1px solid #E5E5EA;">
                            <strong style="color: #1C1C1E; font-size: 12px;">👤 Contact Information</strong>
                        </div>
                        <div style="padding: 10px;">
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">PIC Name:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . htmlspecialchars($ifeReport->pic_name ?? 'N/A') . '</div>
                            </div>
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Mobile No:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . htmlspecialchars($ifeReport->mobile_number ?? 'N/A') . '</div>
                            </div>
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Other Contact No:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . htmlspecialchars($ifeReport->other_mobile_numbers ?? 'N/A') . '</div>
                            </div>
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Email:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . htmlspecialchars($ifeReport->email ?? 'N/A') . '</div>
                            </div>
                        </div>
                    </div>';

        $html .= '  <!-- Follow-up Schedule -->
                    <div style="border: 1px solid #E5E5EA; margin-bottom: 10px; border-radius: 12px; overflow: hidden;">
                        <div style="background-color: #F2F2F7; padding: 14px; border-bottom: 1px solid #E5E5EA;">
                            <strong style="color: #1C1C1E; font-size: 12px;">📅 Follow-up Schedule</strong>
                        </div>
                        <div style="padding: 10px;">
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . date('M j, Y', strtotime($ifeReport->next_followup_date)) . '</div>
                            </div>
                            <div style="padding-bottom: 12px;">
                                <div style="font-weight: 600; font-size: 11px; line-height: 1.5;"><u><span style="color:#c0392b;">Plannig:</span></u></div>
                                <div style="font-weight: 500; line-height: 1.5; padding-left: 8pt;">' . htmlspecialchars($ifeReport->next_followup_plan ?? 'N/A') . '</div>
                            </div>
                        </div>
                    </div>';

        $html .= '</div>';

        return $html;
    }
}
