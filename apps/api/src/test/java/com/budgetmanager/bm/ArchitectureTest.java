package com.budgetmanager.bm;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import jakarta.persistence.Entity;
import org.springframework.web.bind.annotation.RestController;

@AnalyzeClasses(
    packages = "com.budgetmanager.bm",
    importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

  @ArchTest
  static final ArchRule DOMAIN_DOES_NOT_DEPEND_ON_APPLICATION_OR_INFRASTRUCTURE =
      noClasses()
          .that()
          .resideInAPackage("..domain..")
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage("..application..", "..infrastructure..");

  @ArchTest
  static final ArchRule HTTP_ADAPTERS_DO_NOT_ACCESS_PERSISTENCE =
      noClasses()
          .that()
          .resideInAPackage("..infrastructure.http..")
          .should()
          .dependOnClassesThat()
          .resideInAPackage("..infrastructure.persistence..");

  @ArchTest
  static final ArchRule DOMAIN_DOES_NOT_DEPEND_ON_SPRING_SECURITY =
      noClasses()
          .that()
          .resideInAnyPackage("..domain..", "..enums..")
          .should()
          .dependOnClassesThat()
          .resideInAPackage("org.springframework.security..");

  @ArchTest
  static final ArchRule APPLICATION_DOES_NOT_DEPEND_ON_HTTP_ADAPTERS =
      noClasses()
          .that()
          .resideInAPackage("..application..")
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage("..infrastructure.http..", "org.springframework.http..");

  @ArchTest
  static final ArchRule DOMAIN_HAS_NO_JSON_MAPPING =
      noClasses()
          .that()
          .resideInAPackage("..domain..")
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage("com.fasterxml.jackson..", "tools.jackson..");

  @ArchTest
  static final ArchRule CONTROLLERS_RETURN_DTOS_NOT_ENTITIES =
      methods()
          .that()
          .areDeclaredInClassesThat()
          .areAnnotatedWith(RestController.class)
          .and()
          .arePublic()
          .should(notExposeEntities());

  private static ArchCondition<JavaMethod> notExposeEntities() {
    return new ArchCondition<>("not return JPA entities") {
      @Override
      public void check(JavaMethod method, ConditionEvents events) {
        method.getReturnType().getAllInvolvedRawTypes().stream()
            .filter(type -> type.isAnnotatedWith(Entity.class))
            .forEach(entity ->
                events.add(
                    SimpleConditionEvent.violated(
                        method, method.getFullName() + " returns the entity " + entity.getName())));
      }
    };
  }
}
