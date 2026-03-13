package com.worldsim.server.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.util.UUID;

@Entity
@Data
public class Action {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String name;
    private String description;
    
    private double energyCostPerMinute = 0.0;
    private double hungerCostPerMinute = 0.0;
    private double moneyCostPerMinute = 0.0;

    private double funCostPerMinute = 0.0;
}
