import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Button,Form,Popover } from "antd";
import React,{ useState } from "react";

interface IconPickerFieldProps {
    name: string;
    label: string;
    initialValue?: string;
    onIconChange?: (emoji: string) => void;
}

const IconPickerField: React.FC<IconPickerFieldProps> = ({
    name,
    label,
    initialValue,
    onIconChange,
}) => {
    const [selectedEmoji, setSelectedEmoji] = useState(initialValue || "💰");
    const [open, setOpen] = useState(false);

    const handleEmojiSelect = (emoji: { native: string }) => {
        setSelectedEmoji(emoji.native);
        onIconChange?.(emoji.native);
        setOpen(false);
    };

    return (
        <Form.Item name={name} label={label}>
            <Popover
                content={<Picker data={data} onEmojiSelect={handleEmojiSelect} />}
                trigger="click"
                open={open}
                onOpenChange={(v) => setOpen(v)}
            >
                <Button>{selectedEmoji}</Button>
            </Popover>
        </Form.Item>
    );
};

export default IconPickerField;

