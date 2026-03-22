type WithdrawalFieldErrorProps = {
  errors?: string[];
};

export function WithdrawalFieldError({ errors }: WithdrawalFieldErrorProps) {
  if (!errors?.length) {
    return null;
  }

  return <p className="text-xs text-danger">{errors[0]}</p>;
}
