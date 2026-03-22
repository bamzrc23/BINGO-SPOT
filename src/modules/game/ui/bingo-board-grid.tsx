import { cn } from "@/lib/utils";
import type { BingoGrid } from "@/modules/game/domain";

type BingoBoardGridProps = {
  grid: BingoGrid;
  className?: string;
};

export function BingoBoardGrid({ grid, className }: BingoBoardGridProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-1 rounded-xl bg-muted p-1", className)}>
      {grid.map((row, rowIndex) =>
        row.map((value, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}-${value}`}
            className="flex h-12 items-center justify-center rounded-lg bg-card text-sm font-semibold"
          >
            {value}
          </div>
        ))
      )}
    </div>
  );
}
