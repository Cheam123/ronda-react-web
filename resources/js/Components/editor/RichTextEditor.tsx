import TextAlign from '@tiptap/extension-text-align';
import { BackgroundColor, Color, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import clsx from 'clsx';
import { promptText } from '@/lib/dialogs';

const FONT_SIZES = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px'];

interface RichTextEditorProps {
    id?: string;
    /** HTML. Read once when the editor mounts. */
    value: string;
    onChange: (html: string) => void;
    invalid?: boolean;
}

/**
 * The remark editor (it replaces CKEditor 4), with the same toolbar the
 * old one had: undo/redo, colours, links, basic styles, lists, indent,
 * alignment and font size.
 */
export default function RichTextEditor({ id, value, onChange, invalid = false }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false,
                code: false,
                codeBlock: false,
                blockquote: false,
                horizontalRule: false,
                link: { openOnClick: false },
            }),
            TextStyle,
            Color,
            BackgroundColor,
            FontSize,
            TextAlign.configure({ types: ['paragraph'] }),
        ],
        content: value,
        editorProps: { attributes: { class: 'rich-text__content', ...(id ? { id } : {}) } },
        onUpdate: ({ editor: current }) => onChange(current.isEmpty ? '' : current.getHTML()),
    });

    return (
        <div className={clsx('rich-text', invalid && 'is-invalid')}>
            {editor && <Toolbar editor={editor} />}
            <EditorContent editor={editor} />
        </div>
    );
}

function Toolbar({ editor }: { editor: Editor }) {
    const state = useEditorState({
        editor,
        selector: ({ editor: current }) => ({
            bold: current.isActive('bold'),
            italic: current.isActive('italic'),
            underline: current.isActive('underline'),
            link: current.isActive('link'),
            orderedList: current.isActive('orderedList'),
            bulletList: current.isActive('bulletList'),
            inList: current.isActive('listItem'),
            alignCenter: current.isActive({ textAlign: 'center' }),
            alignRight: current.isActive({ textAlign: 'right' }),
            fontSize: (current.getAttributes('textStyle').fontSize as string | undefined) ?? '',
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
        }),
    });

    const chain = () => editor.chain().focus();

    const addLink = async () => {
        const url = await promptText({ title: 'Link URL', inputPlaceholder: 'https://', confirmText: 'Apply' });
        if (url === null) return;

        const link = chain().extendMarkRange('link');
        (url.trim() ? link.setLink({ href: url.trim() }) : link.unsetLink()).run();
    };

    return (
        <div className="rich-text__toolbar">
            <div className="rich-text__group">
                <ToolbarButton
                    icon="mdi-undo"
                    title="Undo"
                    disabled={!state.canUndo}
                    onClick={() => chain().undo().run()}
                />
                <ToolbarButton
                    icon="mdi-redo"
                    title="Redo"
                    disabled={!state.canRedo}
                    onClick={() => chain().redo().run()}
                />
            </div>
            <div className="rich-text__group">
                <ColorButton
                    icon="mdi-format-color-text"
                    title="Text colour"
                    onPick={(color) => chain().setColor(color).run()}
                />
                <ColorButton
                    icon="mdi-format-color-fill"
                    title="Background colour"
                    onPick={(color) => chain().setBackgroundColor(color).run()}
                />
            </div>
            <div className="rich-text__group">
                <ToolbarButton icon="mdi-link-variant" title="Link" active={state.link} onClick={addLink} />
                <ToolbarButton
                    icon="mdi-link-variant-off"
                    title="Unlink"
                    disabled={!state.link}
                    onClick={() => chain().extendMarkRange('link').unsetLink().run()}
                />
            </div>
            <div className="rich-text__group">
                <ToolbarButton
                    icon="mdi-format-bold"
                    title="Bold"
                    active={state.bold}
                    onClick={() => chain().toggleBold().run()}
                />
                <ToolbarButton
                    icon="mdi-format-italic"
                    title="Italic"
                    active={state.italic}
                    onClick={() => chain().toggleItalic().run()}
                />
                <ToolbarButton
                    icon="mdi-format-underline"
                    title="Underline"
                    active={state.underline}
                    onClick={() => chain().toggleUnderline().run()}
                />
                <ToolbarButton
                    icon="mdi-format-list-numbered"
                    title="Numbered list"
                    active={state.orderedList}
                    onClick={() => chain().toggleOrderedList().run()}
                />
                <ToolbarButton
                    icon="mdi-format-list-bulleted"
                    title="Bulleted list"
                    active={state.bulletList}
                    onClick={() => chain().toggleBulletList().run()}
                />
                <ToolbarButton
                    icon="mdi-format-indent-decrease"
                    title="Outdent"
                    disabled={!state.inList}
                    onClick={() => chain().liftListItem('listItem').run()}
                />
                <ToolbarButton
                    icon="mdi-format-indent-increase"
                    title="Indent"
                    disabled={!state.inList}
                    onClick={() => chain().sinkListItem('listItem').run()}
                />
            </div>
            <div className="rich-text__group">
                <ToolbarButton
                    icon="mdi-format-align-left"
                    title="Align left"
                    active={!state.alignCenter && !state.alignRight}
                    onClick={() => chain().setTextAlign('left').run()}
                />
                <ToolbarButton
                    icon="mdi-format-align-center"
                    title="Align centre"
                    active={state.alignCenter}
                    onClick={() => chain().setTextAlign('center').run()}
                />
                <ToolbarButton
                    icon="mdi-format-align-right"
                    title="Align right"
                    active={state.alignRight}
                    onClick={() => chain().setTextAlign('right').run()}
                />
            </div>
            <select
                className="form-select form-select-sm rich-text__size"
                aria-label="Font size"
                value={state.fontSize}
                onChange={(event) =>
                    event.target.value ? chain().setFontSize(event.target.value).run() : chain().unsetFontSize().run()
                }
            >
                <option value="">Size</option>
                {FONT_SIZES.map((size) => (
                    <option key={size} value={size}>
                        {size.replace('px', '')}
                    </option>
                ))}
            </select>
        </div>
    );
}

interface ToolbarButtonProps {
    icon: string;
    title: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
}

function ToolbarButton({ icon, title, active = false, disabled = false, onClick }: ToolbarButtonProps) {
    return (
        <button
            type="button"
            className={clsx('rich-text__button', active && 'is-active')}
            title={title}
            aria-label={title}
            aria-pressed={active}
            disabled={disabled}
            // Keep the selection in the editor while clicking the toolbar.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
        >
            <i className={`mdi ${icon}`} />
        </button>
    );
}

/** A toolbar button that opens the browser's colour picker. */
function ColorButton({ icon, title, onPick }: { icon: string; title: string; onPick: (color: string) => void }) {
    return (
        <label className="rich-text__button rich-text__color" title={title}>
            <i className={`mdi ${icon}`} />
            <input type="color" aria-label={title} onChange={(event) => onPick(event.target.value)} />
        </label>
    );
}
