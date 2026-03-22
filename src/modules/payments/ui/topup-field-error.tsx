type TopupFieldErrorProps = {
  errors?: string[];
};

export function TopupFieldError({ errors }: TopupFieldErrorProps) {
  if (!errors?.length) {
    return null;
  }

  return <p className="text-xs text-danger">{errors[0]}</p>;
}
