"use client";

import { useActionState } from "react";

import {
  activateGameRoundAction,
  createGameRoundAction,
  finalizeGameRoundAction,
  settleGameRoundPrizesAction
} from "@/modules/game/application";
import {
  GAME_DEFAULT_BASE_LINE_PRIZE,
  GAME_ROUND_DEFAULT_EXTRA_SPINS_P1,
  GAME_ROUND_DEFAULT_EXTRA_SPINS_P2,
  GAME_ROUND_DEFAULT_EXTRA_SPINS_P3,
  GAME_ROUND_DEFAULT_LUCKY_BALL_PROBABILITY,
  INITIAL_GAME_ROUND_FORM_STATE
} from "@/modules/game/domain";
import { RoundFormFeedback } from "@/modules/game/ui/round-form-feedback";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";

type GameRoundAdminControlsProps = {
  activeRoundId?: string | null;
};

export function GameRoundAdminControls({ activeRoundId = null }: GameRoundAdminControlsProps) {
  const [createState, createAction, isCreatePending] = useActionState(
    createGameRoundAction,
    INITIAL_GAME_ROUND_FORM_STATE
  );
  const [activateState, activateAction, isActivatePending] = useActionState(
    activateGameRoundAction,
    INITIAL_GAME_ROUND_FORM_STATE
  );
  const [finalizeState, finalizeAction, isFinalizePending] = useActionState(
    finalizeGameRoundAction,
    INITIAL_GAME_ROUND_FORM_STATE
  );
  const [settleState, settleAction, isSettlePending] = useActionState(
    settleGameRoundPrizesAction,
    INITIAL_GAME_ROUND_FORM_STATE
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Programar partida</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={createAction} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="scheduledAt" className="text-sm font-medium">
                Fecha programada (opcional)
              </label>
              <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
            </div>
            <Button type="submit" disabled={isCreatePending}>
              {isCreatePending ? "Creando..." : "Crear partida"}
            </Button>
          </form>
          <RoundFormFeedback state={createState} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Activar sorteo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            action={activateAction}
            className="space-y-3"
            onSubmit={(event) => {
              if (!window.confirm("Confirma iniciar esta partida y ejecutar el sorteo?")) {
                event.preventDefault();
              }
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="gameRoundIdActivate" className="text-sm font-medium">
                ID de partida
              </label>
              <Input
                id="gameRoundIdActivate"
                name="gameRoundId"
                defaultValue={activeRoundId ?? ""}
                placeholder="UUID de partida"
                required
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="luckyBallProbability" className="text-xs font-medium">
                  Prob. bola suerte
                </label>
                <Input
                  id="luckyBallProbability"
                  name="luckyBallProbability"
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  defaultValue={GAME_ROUND_DEFAULT_LUCKY_BALL_PROBABILITY}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="extraSpinsP1" className="text-xs font-medium">
                  Prob. +1 giro
                </label>
                <Input
                  id="extraSpinsP1"
                  name="extraSpinsP1"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  max="1"
                  defaultValue={GAME_ROUND_DEFAULT_EXTRA_SPINS_P1}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="extraSpinsP2" className="text-xs font-medium">
                  Prob. +2 giros
                </label>
                <Input
                  id="extraSpinsP2"
                  name="extraSpinsP2"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  max="1"
                  defaultValue={GAME_ROUND_DEFAULT_EXTRA_SPINS_P2}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="extraSpinsP3" className="text-xs font-medium">
                  Prob. +3 giros
                </label>
                <Input
                  id="extraSpinsP3"
                  name="extraSpinsP3"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  max="1"
                  defaultValue={GAME_ROUND_DEFAULT_EXTRA_SPINS_P3}
                />
              </div>
            </div>
            <Button type="submit" disabled={isActivatePending}>
              {isActivatePending ? "Activando..." : "Activar partida"}
            </Button>
          </form>
          <RoundFormFeedback state={activateState} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Finalizar partida</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            action={finalizeAction}
            className="space-y-3"
            onSubmit={(event) => {
              if (!window.confirm("Confirma finalizar esta partida?")) {
                event.preventDefault();
              }
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="gameRoundIdFinalize" className="text-sm font-medium">
                ID de partida
              </label>
              <Input
                id="gameRoundIdFinalize"
                name="gameRoundId"
                defaultValue={activeRoundId ?? ""}
                placeholder="UUID de partida"
                required
              />
            </div>
            <Button type="submit" variant="danger" disabled={isFinalizePending}>
              {isFinalizePending ? "Finalizando..." : "Finalizar partida"}
            </Button>
          </form>
          <RoundFormFeedback state={finalizeState} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Liquidar premios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            action={settleAction}
            className="space-y-3"
            onSubmit={(event) => {
              if (!window.confirm("Confirma liquidar lineas ganadoras pendientes?")) {
                event.preventDefault();
              }
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="gameRoundIdSettle" className="text-sm font-medium">
                ID de partida
              </label>
              <Input
                id="gameRoundIdSettle"
                name="gameRoundId"
                defaultValue={activeRoundId ?? ""}
                placeholder="UUID de partida"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="basePrize" className="text-sm font-medium">
                Premio base por linea
              </label>
              <Input
                id="basePrize"
                name="basePrize"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={GAME_DEFAULT_BASE_LINE_PRIZE}
              />
            </div>
            <Button type="submit" disabled={isSettlePending}>
              {isSettlePending ? "Liquidando..." : "Pagar lineas ganadoras"}
            </Button>
          </form>
          <RoundFormFeedback state={settleState} />
        </CardContent>
      </Card>
    </div>
  );
}
