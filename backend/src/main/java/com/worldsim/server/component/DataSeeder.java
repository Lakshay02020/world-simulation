package com.worldsim.server.component;

import com.worldsim.server.entity.Action;
import com.worldsim.server.entity.VirtualHuman;
import com.worldsim.server.repository.ActionRepository;
import com.worldsim.server.repository.VirtualHumanRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DataSeeder.class);

    private final ActionRepository actionRepository;
    private final VirtualHumanRepository humanRepository;

    public DataSeeder(ActionRepository actionRepository, VirtualHumanRepository humanRepository) {
        this.actionRepository = actionRepository;
        this.humanRepository = humanRepository;
    }

    @Override
    public void run(String... args) throws Exception {
        if (actionRepository.count() == 0) {
            logger.info("Seeding initial data...");

            // 1. Seed Actions
            Action eatFood = new Action();
            eatFood.setName("Eat Basic Meal");
            eatFood.setDescription("Consumes a standard meal to restore hunger.");
            eatFood.setHungerCostPerMinute(5.0); // Restores 5.0 hunger per minute
            eatFood.setMoneyCostPerMinute(-0.5); // Costs $0.50 per minute to eat
            eatFood = actionRepository.save(eatFood);

            Action sleep = new Action();
            sleep.setName("Sleep");
            sleep.setDescription("Resting in bed to recover energy.");
            sleep.setEnergyCostPerMinute(2.0); // Restores 2.0 energy per minute
            sleep = actionRepository.save(sleep);

            Action workJob = new Action();
            workJob.setName("General Labour");
            workJob.setDescription("Working a standard physical job.");
            workJob.setEnergyCostPerMinute(-0.5); // Drains energy
            workJob.setFunCostPerMinute(-0.2);    // Drains fun
            workJob.setMoneyCostPerMinute(0.3);   // Earns $0.30 per minute ($18/hour)
            workJob = actionRepository.save(workJob);

            Action wander = new Action();
            wander.setName("Wander/Idle");
            wander.setDescription("Just hanging around.");
            wander.setFunCostPerMinute(0.1);      // Slowly restores fun
            wander.setEnergyCostPerMinute(-0.1);  // Slightly drains energy
            wander = actionRepository.save(wander);

            // 2. Seed Virtual Humans
            String[] firstNames = {"John", "Jane", "Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Hank"};
            String[] lastNames = {"Doe", "Smith", "Johnson", "Brown", "Williams", "Jones", "Garcia", "Miller", "Davis", "Martinez"};
            
            for (int i = 0; i < 10; i++) {
                VirtualHuman h = new VirtualHuman();
                h.setFirstName(firstNames[i]);
                h.setLastName(lastNames[i]);
                h.setDateOfBirth(LocalDateTime.now().minusYears(20 + (int)(Math.random() * 30)));
                h.setMoneyBalance(100.0 + Math.random() * 900.0);
                h.setNeedHunger(20.0 + Math.random() * 80.0);
                h.setNeedEnergy(20.0 + Math.random() * 80.0);
                h.setNeedFun(20.0 + Math.random() * 80.0);
                h.setNeedSocial(20.0 + Math.random() * 80.0);
                // Start them slightly scattered around town center
                h.setCoordinateX(40.0 + Math.random() * 20.0);
                h.setCoordinateY(40.0 + Math.random() * 20.0);
                humanRepository.save(h);
            }

            logger.info("Data seeding complete!");
        }
    }
}
