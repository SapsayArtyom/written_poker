/** Очки со знаком и цветом. */
export default function Points({
  value,
  showPlus = true,
  className = 'points',
}: {
  value: number;
  showPlus?: boolean;
  className?: string;
}) {
  const tone = value > 0 ? 'pos' : value < 0 ? 'neg' : 'zero';
  return (
    <span className={`${className} ${tone}`}>
      {value > 0 && showPlus ? '+' : ''}
      {value}
    </span>
  );
}
