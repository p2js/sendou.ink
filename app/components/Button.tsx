import { Link } from "@remix-run/react";
import type { LinkProps } from "@remix-run/react";
import clsx from "clsx";
import * as React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "success"
    | "outlined"
    | "outlined-success"
    | "destructive"
    | "minimal"
    | "minimal-success"
    | "minimal-destructive";
  tiny?: boolean;
  loading?: boolean;
  loadingText?: string;
  icon?: JSX.Element;
  "data-cy"?: string;
}

export function Button(props: ButtonProps) {
  const {
    variant,
    loading,
    children,
    loadingText,
    tiny,
    className,
    icon,
    type = "button",
    ...rest
  } = props;
  return (
    <button
      className={clsx(
        variant,
        {
          "disabled-opaque": props.disabled,
          loading,
          tiny,
        },
        className
      )}
      disabled={props.disabled || loading}
      type={type}
      {...rest}
    >
      {icon &&
        React.cloneElement(icon, {
          className: clsx("button-icon", { lonely: !children }),
        })}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

type LinkButtonProps = Pick<
  ButtonProps,
  "variant" | "children" | "className" | "tiny"
> &
  Pick<LinkProps, "to" | "prefetch" | "state"> & { "data-cy"?: string } & {
    isExternal?: boolean;
  };

export function LinkButton({
  variant,
  children,
  tiny,
  className,
  to,
  prefetch,
  isExternal,
  state,
  "data-cy": testId,
}: LinkButtonProps) {
  if (isExternal) {
    return (
      <a
        className={clsx("button", variant, { tiny }, className)}
        href={to as string}
        data-cy={testId}
        target="_blank"
        rel="noreferrer"
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      className={clsx("button", variant, { tiny }, className)}
      to={to}
      data-cy={testId}
      prefetch={prefetch}
      state={state}
    >
      {children}
    </Link>
  );
}
