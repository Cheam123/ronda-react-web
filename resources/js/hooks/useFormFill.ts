import { useCallback, useMemo, useState } from 'react';
import { isEmptyValue, resolveVisibility } from '@/lib/forms/conditions';
import { isField } from '@/lib/forms/schema';
import type { AnswerValue, Answers, FieldElement, FormSchema } from '@/types/forms';

/** What a file field answers while new files wait to be posted with the form. */
const FILES_ATTACHED = '__files_attached__';

interface UseFormFillOptions {
    /** The whole form, for conditions. */
    schema: FormSchema;
    /** Saved or prefilled answers, by element id. */
    initial: Answers;
    /** Fields a later Handler step owns: never shown or collected here. */
    deferredIds?: string[];
    /** Only these fields are collected (a Handler's section); all when omitted. */
    scopeIds?: string[];
}

export interface FilledEntry {
    id: string;
    type: string;
    label: string;
    value: AnswerValue;
    hidden: boolean;
}

/**
 * State for filling a form: answers, picked attachments, live conditional
 * visibility, and the same checks the old pages ran before posting. The
 * server validates again; this only saves a round trip.
 */
export function useFormFill({ schema, initial, deferredIds = [], scopeIds }: UseFormFillOptions) {
    const [answers, setAnswers] = useState<Answers>(initial);
    const [files, setFileMap] = useState<Record<string, File[]>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const fields = useMemo(
        () => schema.elements.filter(isField).filter((element) => !scopeIds || scopeIds.includes(element.id)),
        [schema, scopeIds],
    );

    /** The answer a field posts: picked files stand in for the upload. */
    const valueOf = useCallback(
        (element: FieldElement): AnswerValue => {
            if (element.type === 'file' && (files[element.id]?.length ?? 0) > 0) return FILES_ATTACHED;
            return answers[element.id] ?? null;
        },
        [answers, files],
    );

    const visibility = useMemo(() => {
        const current: Answers = { ...answers };
        fields.forEach((element) => {
            current[element.id] = valueOf(element);
        });
        const resolved = resolveVisibility(schema, current);
        deferredIds.forEach((id) => {
            resolved[id] = false;
        });
        return resolved;
    }, [schema, answers, fields, valueOf, deferredIds]);

    const clearError = (id: string) =>
        setErrors((current) => {
            if (!current[id]) return current;
            const next = { ...current };
            delete next[id];
            return next;
        });

    const setAnswer = useCallback((id: string, value: AnswerValue) => {
        setAnswers((current) => ({ ...current, [id]: value }));
        clearError(id);
    }, []);

    const setFiles = useCallback((id: string, picked: File[]) => {
        setFileMap((current) => ({ ...current, [id]: picked }));
        clearError(id);
    }, []);

    /** Checks the visible fields; returns the id of the first problem, or null. */
    const validate = useCallback((): string | null => {
        const found: Record<string, string> = {};

        fields.forEach((element) => {
            if (visibility[element.id] === false) return;
            const value = valueOf(element);

            if (element.mandatory && isEmptyValue(value)) {
                found[element.id] = 'This field is required.';
                return;
            }

            if (element.type === 'multi-choice' || element.type === 'multi-select') {
                const count = Array.isArray(value) ? value.length : 0;
                const min = parseInt(String(element.min ?? ''), 10) || 0;
                const max = parseInt(String(element.max ?? ''), 10) || 0;
                if (min && count < min) found[element.id] = `Please select at least ${min} option(s)`;
                else if (max && count > max) found[element.id] = `Please select no more than ${max} option(s)`;
            }
        });

        setErrors(found);
        return Object.keys(found)[0] ?? null;
    }, [fields, visibility, valueOf]);

    /** Every collected field, hidden ones posted empty (the submit / edit payload). */
    const entries = useCallback(
        (): FilledEntry[] =>
            fields.map((element) => {
                const hidden = visibility[element.id] === false;
                return {
                    id: element.id,
                    type: element.type,
                    label: element.label,
                    value: hidden ? null : valueOf(element),
                    hidden,
                };
            }),
        [fields, visibility, valueOf],
    );

    /** Picked attachments as files[el_id][], for a multipart post. */
    const attachments = useCallback(
        () =>
            Object.fromEntries(
                Object.entries(files).filter(([id, picked]) => picked.length > 0 && visibility[id] !== false),
            ),
        [files, visibility],
    );

    return { answers, files, errors, setErrors, visibility, setAnswer, setFiles, validate, entries, attachments };
}

export type FormFill = ReturnType<typeof useFormFill>;
