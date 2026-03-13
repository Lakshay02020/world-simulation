package com.worldsim.server.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.util.UUID;
import java.time.LocalDateTime;

@Entity
@Data
public class VirtualHuman {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String firstName;
    private String lastName;
    private LocalDateTime dateOfBirth;
    private boolean isPlayerControlled = false;

    // Needs System (0.0 to 100.0)
    private double needHunger = 100.0;
    private double needEnergy = 100.0;
    private double needSocial = 100.0;
    private double needFun = 100.0;
    
    private double moneyBalance = 0.0;

    // State & Execution
    @ManyToOne
    @JoinColumn(name = "current_action_id")
    private Action currentAction;
    private LocalDateTime actionStartTime;
    private LocalDateTime actionEndTime;

    // Map Coordinates
    private double coordinateX;
    private double coordinateY;
}
