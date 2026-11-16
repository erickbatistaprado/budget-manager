import { Select, type SelectProps } from '@/components/ui';
import { Tooltip } from '@/components';
import { forwardRef, type JSX, type ReactNode } from 'react';

interface SelectWithTooltipProps extends SelectProps {
  tooltip: string;
  icon: ReactNode;
}

const SelectWithTooltip = forwardRef<HTMLSelectElement, SelectWithTooltipProps>(
  function SelectWithTooltip({ tooltip, icon, ...props }, ref): JSX.Element {
    return (
      <div className="flex flex-col gap-1">
        <Tooltip
          fullWidth={props.fullWidth !== false}
          placement="top"
          tooltip={tooltip}
        >
          <Select
            startAdornment={icon}
            label={tooltip}
            ref={ref}
            aria-label={tooltip}
            {...props}
          />
        </Tooltip>
      </div>
    );
  }
);
export default SelectWithTooltip;
