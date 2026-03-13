package com.worldsim.server.controller;

import com.worldsim.server.entity.VirtualHuman;
import com.worldsim.server.repository.VirtualHumanRepository;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/humans")
@CrossOrigin(origins = "*") // Allow Angular proxy or direct calls
public class HumanController {

    private final VirtualHumanRepository humanRepository;

    public HumanController(VirtualHumanRepository humanRepository) {
        this.humanRepository = humanRepository;
    }

    @GetMapping
    public List<VirtualHuman> getAllHumans() {
        return humanRepository.findAll();
    }
}
