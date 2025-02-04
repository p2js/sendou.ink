import type {
  AbilityPoints,
  AnalyzedBuild,
  DamageReceiver,
  DamageType,
} from "./types";
import objectDamages from "./object-dmg.json";
import type {
  MainWeaponId,
  SpecialWeaponId,
  SubWeaponId,
} from "../in-game-lists";
import {
  damageTypeToWeaponType,
  DAMAGE_RECEIVERS,
  objectDamageJsonKeyPriority,
} from "./constants";
import { roundToNDecimalPlaces } from "~/utils/number";
import { objectHitPoints } from "./objectHitPoints";

export function damageTypeToMultipliers({
  type,
  weapon,
}: {
  type: DamageType;
  weapon:
    | {
        type: "MAIN";
        id: MainWeaponId;
      }
    | {
        type: "SUB";
        id: SubWeaponId;
      }
    | {
        type: "SPECIAL";
        id: SpecialWeaponId;
      };
}) {
  for (const key of jsonKeysToCeck(type)) {
    const objectDamagesObj = objectDamages[key];

    let ok = false;

    if (weapon.type === "MAIN") {
      ok = (objectDamagesObj.mainWeaponIds as MainWeaponId[]).includes(
        weapon.id
      );
    } else if (weapon.type === "SUB") {
      ok = (objectDamagesObj.subWeaponIds as SubWeaponId[]).includes(weapon.id);
    } else if (weapon.type === "SPECIAL") {
      ok = (objectDamagesObj.specialWeaponIds as SpecialWeaponId[]).includes(
        weapon.id
      );
    }

    if (ok) {
      return objectDamagesObj.rates;
    }
  }

  return null;
}
const objectDamageJsonKeyPriorityEntries = Object.entries(
  objectDamageJsonKeyPriority
);

// for example blaster belongs to both Blaster_KillOneShot
// and Blaster categories so it needs to be specified
// which damage type uses which
function jsonKeysToCeck(type: DamageType) {
  const result: Array<keyof typeof objectDamages> = [];

  for (const [key, value] of objectDamageJsonKeyPriorityEntries) {
    if (value?.includes(type)) {
      result.push(key as keyof typeof objectDamages);
    }
  }

  if (result.length) return result;

  for (const [key, value] of objectDamageJsonKeyPriorityEntries) {
    if (!value) {
      result.push(key as keyof typeof objectDamages);
    }
  }

  return result;
}

export function multipliersToRecordWithFallbacks(
  multipliers: ReturnType<typeof damageTypeToMultipliers>
) {
  return Object.fromEntries(
    DAMAGE_RECEIVERS.map((receiver) => [
      receiver,
      multipliers?.find((m) => m.target === receiver)?.rate ?? 1,
    ])
  ) as Record<DamageReceiver, number>;
}

const objectShredderMultipliers = objectDamages.ObjectEffect_Up.rates;
export function calculateDamage({
  analyzed,
  mainWeaponId,
  abilityPoints,
  damageType,
}: {
  analyzed: AnalyzedBuild;
  mainWeaponId: MainWeaponId;
  abilityPoints: AbilityPoints;
  damageType: DamageType;
}) {
  const filteredDamages = analyzed.stats.damages.filter(
    (d) => d.type === damageType
  );

  const hitPoints = objectHitPoints(abilityPoints);
  const multipliers = Object.fromEntries(
    filteredDamages.map((damage) => {
      const weaponType = damageTypeToWeaponType[damage.type];
      const weaponId: any =
        weaponType === "MAIN"
          ? mainWeaponId
          : weaponType === "SUB"
          ? analyzed.weapon.subWeaponSplId
          : analyzed.weapon.specialWeaponSplId;

      return [
        damage.type,
        multipliersToRecordWithFallbacks(
          damageTypeToMultipliers({
            type: damage.type,
            weapon: { type: weaponType, id: weaponId },
          })
        ),
      ];
    })
  );

  return DAMAGE_RECEIVERS.map((receiver) => {
    const damageReceiverHp = hitPoints[receiver];

    return {
      receiver,
      hitPoints: damageReceiverHp,
      damages: filteredDamages
        .flatMap((damage) => [
          { ...damage, objectShredder: false },
          { ...damage, objectShredder: true },
        ])
        .map((damage) => {
          const baseMultiplier = multipliers[damage.type]![receiver];
          const objectShredderMultiplier =
            objectShredderMultipliers.find((m) => m.target === receiver)
              ?.rate ?? 1;
          const multiplier =
            baseMultiplier *
            (damage.objectShredder ? objectShredderMultiplier : 1);

          const damagePerHit = roundToNDecimalPlaces(damage.value * multiplier);

          const hitsToDestroy = Math.ceil(damageReceiverHp / damagePerHit);

          return {
            value: damagePerHit,
            hitsToDestroy,
            multiplier: roundToNDecimalPlaces(multiplier, 2),
            type: damage.type,
            id: `${damage.id}-${String(damage.objectShredder)}`,
            distance: damage.distance,
            objectShredder: damage.objectShredder,
          };
        }),
    };
  });
}
