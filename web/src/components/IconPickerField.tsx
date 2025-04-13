import React, { useState } from "react";
import { Form, Popover, Button } from "antd";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

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

    const handleEmojiSelect = (emoji: any) => {
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

