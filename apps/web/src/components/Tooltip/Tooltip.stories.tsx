import { Button } from '@/components/ui';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { JSX } from 'react';
import Tooltip, { type TooltipProps } from './Tooltip.component';

const meta: Meta<typeof Tooltip> = {
  title: 'Components/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  argTypes: {
    tooltip: { control: 'text' },
    placement: {
      control: { type: 'select' },
      options: ['top', 'bottom', 'left', 'right'],
    },
    children: { control: false },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  args: { tooltip: 'This is a tooltip!' },
  render: (args: TooltipProps): JSX.Element => (
    <Tooltip {...args}>
      <div className="w-32 cursor-pointer rounded bg-[var(--ctp-blue)] px-4 py-2 text-[var(--ctp-text)] hover:bg-[var(--ctp-blue)]">
        Hover me
      </div>
    </Tooltip>
  ),
};

export const Bottom: Story = {
  args: { tooltip: 'Tooltip at the bottom', placement: 'bottom' },
  render: (args: TooltipProps): JSX.Element => (
    <Tooltip {...args}>
      <Button variant="primary" className="w-32">
        Hover me
      </Button>
    </Tooltip>
  ),
};

export const Left: Story = {
  args: { tooltip: 'Tooltip on the left', placement: 'left' },
  render: (args: TooltipProps): JSX.Element => (
    <Tooltip {...args}>
      <Button variant="secondary" className="w-32">
        Hover me
      </Button>
    </Tooltip>
  ),
};

export const Top: Story = {
  args: { tooltip: 'Tooltip on the top', placement: 'top' },
  render: (args: TooltipProps): JSX.Element => (
    <Tooltip {...args}>
      <Button variant="secondary" className="w-32">
        Hover me
      </Button>
    </Tooltip>
  ),
};
