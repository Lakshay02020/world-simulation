package com.worldsim.server.service;

import com.worldsim.server.entity.Action;
import com.worldsim.server.entity.VirtualHuman;
import com.worldsim.server.repository.ActionRepository;
import com.worldsim.server.repository.VirtualHumanRepository;
import com.worldsim.server.util.UtilityCurveEvaluator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class AIAutopilotService {

    private static final Logger logger = LoggerFactory.getLogger(AIAutopilotService.class);

    private final VirtualHumanRepository humanRepository;
    private final ActionRepository actionRepository;

    // Standard decay rates per in-game minute
    private static final double HUNGER_DECAY_RATE = 0.2;
    private static final double ENERGY_DECAY_RATE = 0.1;
    private static final double FUN_DECAY_RATE = 0.15;
    private static final double SOCIAL_DECAY_RATE = 0.1;

    public AIAutopilotService(VirtualHumanRepository humanRepository, ActionRepository actionRepository) {
        this.humanRepository = humanRepository;
        this.actionRepository = actionRepository;
    }

    /**
     * Executes every 1 second (1000ms).
     * Represents 1 in-game minute passing.
     */
    @Scheduled(fixedRate = 1000)
    @Transactional
    public void processSimulationTick() {
        LocalDateTime now = LocalDateTime.now();
        List<VirtualHuman> aiHumans = humanRepository.findAll().stream()
                .filter(h -> !h.isPlayerControlled())
                .toList();

        if (aiHumans.isEmpty()) return;

        List<Action> allActions = actionRepository.findAll();

        for (VirtualHuman human : aiHumans) {
            processHuman(human, now, allActions);
        }
    }

    private void processHuman(VirtualHuman human, LocalDateTime now, List<Action> allActions) {
        String logPrefix = "Human [" + human.getFirstName() + " " + human.getLastName() + "] : ";

        // 1. Process current action if one exists
        if (human.getCurrentAction() != null) {
            Action act = human.getCurrentAction();
            
            // --- MOVEMENT LOGIC ---
            double targetX = 50.0; double targetY = 50.0;
            if (act.getName().equals("Sleep")) { targetX = 10.0; targetY = 10.0; }
            else if (act.getName().equals("Eat Basic Meal")) { targetX = 80.0; targetY = 80.0; }
            else if (act.getName().equals("General Labour")) { targetX = 80.0; targetY = 20.0; }
            else if (act.getName().equals("Wander/Idle")) {
                int hash = human.getId().hashCode();
                targetX = 35.0 + (Math.abs(hash) % 30); // Random deterministic X between 35 and 65
                targetY = 35.0 + (Math.abs(hash / 100) % 30); // Random deterministic Y between 35 and 65
            }
            
            double dx = targetX - human.getCoordinateX();
            double dy = targetY - human.getCoordinateY();
            double dist = Math.sqrt(dx * dx + dy * dy);

            // Travel speed is 2 units per tick
            if (dist > 2.0) {
                human.setCoordinateX(human.getCoordinateX() + (dx / dist) * 2.0);
                human.setCoordinateY(human.getCoordinateY() + (dy / dist) * 2.0);
                
                // Still apply baseline decay while travelling!
                human.setNeedHunger(clamp(human.getNeedHunger() - HUNGER_DECAY_RATE));
                human.setNeedEnergy(clamp(human.getNeedEnergy() - ENERGY_DECAY_RATE));
                human.setNeedFun(clamp(human.getNeedFun() - FUN_DECAY_RATE));
                human.setNeedSocial(clamp(human.getNeedSocial() - SOCIAL_DECAY_RATE));
                
                humanRepository.save(human);
                return; // Stop processing action stats until they arrive
            } else {
                human.setCoordinateX(targetX);
                human.setCoordinateY(targetY);
            }
            // --- END MOVEMENT LOGIC ---
            
            // Apply step-by-step stat deltas
            human.setNeedHunger(clamp(human.getNeedHunger() + act.getHungerCostPerMinute()));
            human.setNeedEnergy(clamp(human.getNeedEnergy() + act.getEnergyCostPerMinute()));
            human.setNeedFun(clamp(human.getNeedFun() + act.getFunCostPerMinute()));
            human.setMoneyBalance(human.getMoneyBalance() + act.getMoneyCostPerMinute());

            // Check if action is finished (e.g., if it was a timed action) or if stats are maxed
            // For now, if recovering a stat (e.g. eating) and it hits 100, finish the action.
            boolean shouldFinish = false;
            if (act.getHungerCostPerMinute() > 0 && human.getNeedHunger() >= 100.0) shouldFinish = true;
            if (act.getEnergyCostPerMinute() > 0 && human.getNeedEnergy() >= 100.0) shouldFinish = true;
            if (act.getFunCostPerMinute() > 0 && human.getNeedFun() >= 100.0) shouldFinish = true;
            
            // If they are strictly draining stats (e.g. wandering or working), they shouldn't do it forever.
            // 1. Finish wandering/idling if a critical need appears
            if (act.getName().equals("Wander/Idle")) {
                if (human.getNeedHunger() < 50 || human.getNeedEnergy() < 30) shouldFinish = true;
                if (Math.random() < 0.05) shouldFinish = true; // 5% chance to just stop wandering naturally every minute
            }
            
            // 2. Finish working only if they are too tired or bored (let them become billionaires if they can survive it!)
            if (act.getName().equals("General Labour")) {
                if (human.getNeedEnergy() < 15.0 || human.getNeedFun() < 10.0) {
                     shouldFinish = true;
                }
            }

            if (shouldFinish) {
                logger.info(logPrefix + "Finished action: " + act.getName() + " (Stats restored)");
                human.setCurrentAction(null);
                human.setActionStartTime(null);
                humanRepository.save(human);
            } else {
                // Keep doing the action
                humanRepository.save(human);
                return;
            }
        }

        // 2. If no action, apply baseline decay
        human.setNeedHunger(clamp(human.getNeedHunger() - HUNGER_DECAY_RATE));
        human.setNeedEnergy(clamp(human.getNeedEnergy() - ENERGY_DECAY_RATE));
        human.setNeedFun(clamp(human.getNeedFun() - FUN_DECAY_RATE));
        human.setNeedSocial(clamp(human.getNeedSocial() - SOCIAL_DECAY_RATE));

        // 3. Evaluate Needs via Utility Curves
        // We use an exponential curve for hunger and energy (survival) and linear for fun/social.
        double scoreHunger = UtilityCurveEvaluator.evaluateInverseExponentialNeed(human.getNeedHunger(), 5.0);
        double scoreEnergy = UtilityCurveEvaluator.evaluateInverseExponentialNeed(human.getNeedEnergy(), 4.0);
        double scoreFun = UtilityCurveEvaluator.evaluateInverseLinearNeed(human.getNeedFun());
        
        // Find highest priority need
        double maxScore = Math.max(scoreHunger, Math.max(scoreEnergy, scoreFun));

        // If all needs are met (scores are low), maybe just wander/idle
        if (maxScore < 0.2) {
            // Find "Idle" or "Wander" action
            Action idleAct = allActions.stream().filter(a -> a.getName().contains("Idle") || a.getName().contains("Wander")).findFirst().orElse(null);
            if (idleAct != null && Math.random() < 0.1) { // 10% chance to start wandering if idle
                assignAction(human, idleAct, logPrefix, "Idle threshold reached.");
            } else {
                humanRepository.save(human); // Just save decays
            }
            return;
        }

        // 4. Select Action based on highest need
        if (maxScore == scoreHunger) {
            Action eatAct = allActions.stream().filter(a -> a.getHungerCostPerMinute() > 0).findFirst().orElse(null);
            if (eatAct != null && human.getMoneyBalance() >= 5.0) { // basic money check
                assignAction(human, eatAct, logPrefix, "Hunger is critical (Score: " + String.format("%.2f", scoreHunger) + ")");
            } else if (eatAct != null) {
                 // Needs to eat, but no money -> must work first!
                 Action workAct = allActions.stream().filter(a -> a.getMoneyCostPerMinute() > 0).findFirst().orElse(null);
                 if (workAct != null) {
                     assignAction(human, workAct, logPrefix, "Hungry but broke! Must work first.");
                 }
            }
        } else if (maxScore == scoreEnergy) {
            Action sleepAct = allActions.stream().filter(a -> a.getEnergyCostPerMinute() > 0).findFirst().orElse(null);
            if (sleepAct != null) {
                assignAction(human, sleepAct, logPrefix, "Energy is critical (Score: " + String.format("%.2f", scoreEnergy) + ")");
            }
        } else if (maxScore == scoreFun) {
            Action funAct = allActions.stream().filter(a -> a.getFunCostPerMinute() > 0).findFirst().orElse(null);
             if (funAct != null) {
                 assignAction(human, funAct, logPrefix, "Bored (Score: " + String.format("%.2f", scoreFun) + ")");
             }
        }
    }

    private void assignAction(VirtualHuman human, Action act, String logPrefix, String reason) {
        human.setCurrentAction(act);
        human.setActionStartTime(LocalDateTime.now());
        humanRepository.save(human);
        logger.info(logPrefix + "Started action: " + act.getName() + " | Reason: " + reason);
    }

    private double clamp(double val) {
        return Math.max(0.0, Math.min(100.0, val));
    }
}
