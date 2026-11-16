'use client';

import { DismissOverlay } from '@/components/ui';
import { NewTransaction, SideMenu, Tooltip } from '@/components';
import { useProfileImage } from '@/hooks';
import useHideOnScroll from '@/hooks/useHideOnScroll.hook';
import { useI18n } from '@/i18n/useI18n';
import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useMemo, useState, type JSX } from 'react';
import { AiOutlinePlus } from 'react-icons/ai';
import { VscRobot } from 'react-icons/vsc';

export default function Header(): JSX.Element {
  const { data: profileImage } = useProfileImage();
  const { t } = useI18n();

  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const profileImageUrl: string | undefined = useMemo(
    (): string | undefined =>
      profileImage ? URL.createObjectURL(profileImage) : undefined,
    [profileImage]
  );

  useEffect((): (() => void) | undefined => {
    if (!profileImageUrl) {
      return undefined;
    }

    return (): void => URL.revokeObjectURL(profileImageUrl);
  }, [profileImageUrl]);

  const hidden: boolean = useHideOnScroll(isLeftOpen || isRightOpen);

  function closeMenu(): void {
    setIsLeftOpen(false);
    setIsRightOpen(false);
  }

  // The drawers and overlay stay outside the sliding bar: a translated parent would become their
  // containing block, pushing the closed drawers into the page and making it scroll sideways.
  return (
    <>
      <div
        data-testid="header-bar"
        className={clsx(
          'sticky top-0 z-30 w-full border-b border-[var(--ctp-surface1)] bg-[var(--ctp-mantle)] px-4 text-[var(--ctp-text)] shadow-md motion-safe:transition-transform motion-safe:duration-200',
          hidden && '-translate-y-full'
        )}
      >
        <header className="flex justify-between py-2">
          <Tooltip tooltip={t.header.menuTooltip} placement="right">
            {profileImageUrl ? (
              <div className="relative h-11 w-11 cursor-pointer overflow-hidden rounded-full">
                <Image
                  src={profileImageUrl}
                  onClick={(): void =>
                    setIsLeftOpen((prev: boolean): boolean => !prev)
                  }
                  className="object-cover"
                  alt={t.header.profileAlt}
                  fill
                />
              </div>
            ) : (
              <VscRobot
                size={44}
                className="cursor-pointer rounded-md p-1 hover:text-[var(--ctp-subtext0)]"
                onClick={(): void =>
                  setIsLeftOpen((prev: boolean): boolean => !prev)
                }
              />
            )}
          </Tooltip>
          <Tooltip tooltip={t.header.newTransactionTooltip} placement="left">
            <AiOutlinePlus
              className="cursor-pointer rounded-md p-1 hover:text-[var(--ctp-subtext0)]"
              size={44}
              onClick={(): void =>
                setIsRightOpen((prev: boolean): boolean => !prev)
              }
            />
          </Tooltip>
        </header>
      </div>
      {(isLeftOpen || isRightOpen) && (
        <DismissOverlay aria-label={t.common.cancel} onClick={closeMenu} />
      )}
      <div
        inert={!isLeftOpen}
        data-testid="side-menu-drawer"
        className={clsx(
          'fixed top-0 left-0 z-50 h-full w-72 max-w-full transform bg-[var(--ctp-mantle)] shadow-lg transition-transform duration-300',
          isLeftOpen
            ? 'pointer-events-auto translate-x-0'
            : 'pointer-events-none -translate-x-full'
        )}
      >
        <SideMenu onClose={closeMenu} />
      </div>
      <div
        inert={!isRightOpen}
        data-testid="new-entry-drawer"
        className={clsx(
          'fixed top-0 right-0 z-50 h-full w-full max-w-[500px] transform overflow-y-auto bg-[var(--ctp-mantle)] shadow-lg transition-transform duration-300',
          isRightOpen
            ? 'pointer-events-auto translate-x-0'
            : 'pointer-events-none translate-x-full'
        )}
      >
        <NewTransaction onClose={closeMenu} />
      </div>
    </>
  );
}
