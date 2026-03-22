type BoardFieldErrorProps = {
  errors?: string[];
};

export function BoardFieldError({ errors }: BoardFieldErrorProps) {
  if (!errors?.length) {
    return null;
  }

  return <p className="text-xs text-danger">{errors[0]}</p>;
}
