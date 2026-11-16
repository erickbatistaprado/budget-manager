'use client';

import { TextInput, IconButton, type TextInputProps } from '@/components/ui';
import { useState, type HTMLInputTypeAttribute, type JSX } from 'react';
import { useI18n } from '@/i18n/useI18n';
import type { IconType } from 'react-icons';
import { PiEyeDuotone, PiEyeSlashDuotone } from 'react-icons/pi';

interface InputProps extends TextInputProps {
  label: string;
}

export default function Input({
  id,
  value,
  label,
  type,
  className,
  onKeyDown,
  onChange,
  ...props
}: Readonly<InputProps>): JSX.Element {
  const { language } = useI18n();
  const eyeLabels =
    language === 'pt'
      ? ['Mostrar senha', 'Ocultar senha']
      : ['Show password', 'Hide password'];
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);

  const EyeIcon: IconType = isPasswordVisible
    ? PiEyeDuotone
    : PiEyeSlashDuotone;

  function handleType(): HTMLInputTypeAttribute | undefined {
    if (type === 'password' && isPasswordVisible) {
      return 'text';
    }
    return type;
  }

  return (
    <div className="relative">
      <TextInput
        className={className}
        label={label}
        placeholder=" "
        id={id}
        type={handleType()}
        value={value}
        onKeyDown={onKeyDown}
        onChange={onChange}
        {...props}
        endAdornment={
          type === 'password' && (
            <IconButton
              aria-label={eyeLabels[Number(isPasswordVisible)]}
              onClick={(): void => setIsPasswordVisible(!isPasswordVisible)}
            >
              <EyeIcon data-testid="eye-icon" size={22} />
            </IconButton>
          )
        }
      />
    </div>
  );
}
