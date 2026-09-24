import React from 'react';

export type IconName =
  | 'restart_alt'
  | 'close'
  | 'search'
  | 'volume_up'
  | 'graphic_eq'
  | 'record_voice_over'
  | 'touch_app'
  | 'check_circle'
  | 'schedule'
  | 'visibility'
  | 'arrow_back'
  | 'arrow_forward'
  | 'check'
  | 'task_alt'
  | 'add_circle'
  | 'person';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number | string;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  className = '',
  ...props
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;

  const renderPath = () => {
    switch (name) {
      case 'volume_up':
        return (
          <>
            <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" />
            <path
              d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        );

      case 'graphic_eq':
        return (
          <g fill="currentColor">
            <rect x="3" y="9" width="2" height="6" rx="1" />
            <rect x="7" y="6" width="2" height="12" rx="1" />
            <rect x="11" y="3" width="2" height="18" rx="1" />
            <rect x="15" y="6" width="2" height="12" rx="1" />
            <rect x="19" y="9" width="2" height="6" rx="1" />
          </g>
        );

      case 'record_voice_over':
        return (
          <>
            <circle cx="9" cy="8" r="4" fill="currentColor" />
            <path
              d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M17 9.5a4 4 0 0 1 0 5M19.5 7a7.5 7.5 0 0 1 0 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        );

      case 'close':
        return (
          <path
            d="M6 18L18 6M6 6l12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'check':
        return (
          <path
            d="M5 13l4 4L19 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'check_circle':
        return (
          <>
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M8.5 12.5l2.5 2.5 4.5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );

      case 'task_alt':
        return (
          <>
            <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" />
            <path
              d="M8 12.5l2.5 2.5 5.5-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );

      case 'search':
        return (
          <>
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M16.5 16.5L21 21"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        );

      case 'restart_alt':
        return (
          <>
            <path
              d="M12 4a8 8 0 1 0 7.4 5M19.5 4v5h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );

      case 'visibility':
        return (
          <>
            <path
              d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
          </>
        );

      case 'touch_app':
        return (
          <path
            d="M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.44-.72c-.08-.02-.17-.03-.25-.03-.38 0-.73.16-.98.41L4.6 18.63l5.06 5.06c.35.35.84.56 1.35.56h7.62c.93 0 1.73-.64 1.93-1.55l1.04-4.86c.03-.13.04-.26.04-.39 0-.75-.45-1.42-1.16-1.73l-.64-.29z"
            fill="currentColor"
          />
        );

      case 'schedule':
        return (
          <>
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 7v5l3 2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );

      case 'arrow_back':
        return (
          <path
            d="M19 12H5M12 19l-7-7 7-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'arrow_forward':
        return (
          <path
            d="M5 12h14M12 5l7 7-7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'add_circle':
        return (
          <>
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 8v8M8 12h8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        );

      case 'person':
        return (
          <>
            <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width={pixelSize}
      height={pixelSize}
      className={`inline-block shrink-0 align-middle ${className}`}
      aria-hidden="true"
      {...props}
    >
      {renderPath()}
    </svg>
  );
};
