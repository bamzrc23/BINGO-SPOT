import { cn } from "@/lib/utils";
import type { BingoGrid } from "@/modules/game/domain";
import type { BingoLineType } from "@/types/domain";

type LiveBingoBoardGridProps = {
  grid: BingoGrid;
  markedNumbers: Set<number>;
  multiplierByNumber: Map<number, number>;
  completedLines: BingoLineType[];
  paidLines: BingoLineType[];
  className?: string;
  compact?: boolean;
};

function cellBelongsToLine(rowIndex: number, colIndex: number, lineType: BingoLineType): boolean {
  if (lineType === "row_1") return rowIndex === 0;
  if (lineType === "row_2") return rowIndex === 1;
  if (lineType === "row_3") return rowIndex === 2;
  if (lineType === "col_1") return colIndex === 0;
  if (lineType === "col_2") return colIndex === 1;
  return colIndex === 2;
}

function cellInAnyLine(
  rowIndex: number,
  colIndex: number,
  lineTypes: BingoLineType[]
): boolean {
  return lineTypes.some((lineType) => cellBelongsToLine(rowIndex, colIndex, lineType));
}

export function LiveBingoBoardGrid({
  grid,
  markedNumbers,
  multiplierByNumber,
  completedLines,
  paidLines,
  className,
  compact = false
}: LiveBingoBoardGridProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-1.5 rounded-2xl bg-muted p-1.5", className)}>
      {grid.map((row, rowIndex) =>
        row.map((value, colIndex) => {
          const isMarked = markedNumbers.has(value);
          const isInCompletedLine = cellInAnyLine(rowIndex, colIndex, completedLines);
          const isInPaidLine = cellInAnyLine(rowIndex, colIndex, paidLines);
          const multiplier = multiplierByNumber.get(value);

          return (
            <div
              key={`${rowIndex}-${colIndex}-${value}`}
              className={cn(
                "relative flex items-center justify-center rounded-xl border font-bold transition-all duration-300",
                compact ? "h-12 text-xl sm:h-11 sm:text-base" : "h-14 text-base",
                isMarked ? "border-primary/50 bg-primary/15 text-primary" : "border-border bg-card",
                isInCompletedLine ? "border-success/50 bg-success/10 text-success" : null,
                isInPaidLine ? "border-success bg-success/20 text-success shadow-soft" : null
              )}
            >
              {value}
              {multiplier ? (
                <span
                  className={cn(
                    "absolute right-1 top-1 rounded-full px-1 py-0.5 font-semibold",
                    compact ? "text-[9px] sm:text-[10px]" : "text-[10px]",
                    multiplier === 5
                      ? "bg-danger/10 text-danger"
                      : multiplier === 3
                        ? "bg-primary/10 text-primary"
                        : "bg-success/10 text-success"
                  )}
                >
                  x{multiplier}
                </span>
              ) : null}
              {isMarked ? (
                <span className="absolute bottom-1.5 left-1.5 h-2 w-2 rounded-full bg-primary/80" />
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
