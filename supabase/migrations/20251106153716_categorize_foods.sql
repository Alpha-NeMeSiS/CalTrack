/*
  # Categorize existing foods based on their names

  1. Changes
    - Update foods with appropriate categories based on keyword matching
*/

DO $$
BEGIN
  UPDATE foods SET category = 'fruits' 
  WHERE category = 'autre' AND (
    LOWER(name) LIKE '%pomme%' OR LOWER(name) LIKE '%banane%' OR LOWER(name) LIKE '%orange%' OR 
    LOWER(name) LIKE '%fraise%' OR LOWER(name) LIKE '%raisin%' OR LOWER(name) LIKE '%pêche%' OR
    LOWER(name) LIKE '%poire%' OR LOWER(name) LIKE '%mangue%' OR LOWER(name) LIKE '%ananas%' OR
    LOWER(name) LIKE '%kiwi%' OR LOWER(name) LIKE '%citron%' OR LOWER(name) LIKE '%pastèque%' OR
    LOWER(name) LIKE '%melon%' OR LOWER(name) LIKE '%cerise%' OR LOWER(name) LIKE '%myrtille%'
  );

  UPDATE foods SET category = 'vegetables' 
  WHERE category = 'autre' AND (
    LOWER(name) LIKE '%tomate%' OR LOWER(name) LIKE '%carotte%' OR LOWER(name) LIKE '%salade%' OR
    LOWER(name) LIKE '%épinard%' OR LOWER(name) LIKE '%brocoli%' OR LOWER(name) LIKE '%chou%' OR
    LOWER(name) LIKE '%poivron%' OR LOWER(name) LIKE '%oignon%' OR LOWER(name) LIKE '%ail%' OR
    LOWER(name) LIKE '%courge%' OR LOWER(name) LIKE '%courgette%' OR LOWER(name) LIKE '%concombre%' OR
    LOWER(name) LIKE '%champignon%' OR LOWER(name) LIKE '%aubergine%' OR LOWER(name) LIKE '%betterave%' OR
    LOWER(name) LIKE '%asperge%' OR LOWER(name) LIKE '%haricot%' OR LOWER(name) LIKE '%pois%' OR
    LOWER(name) LIKE '%légume%'
  );

  UPDATE foods SET category = 'proteins' 
  WHERE category = 'autre' AND (
    LOWER(name) LIKE '%poulet%' OR LOWER(name) LIKE '%viande%' OR LOWER(name) LIKE '%boeuf%' OR
    LOWER(name) LIKE '%poisson%' OR LOWER(name) LIKE '%saumon%' OR LOWER(name) LIKE '%trout%' OR
    LOWER(name) LIKE '%oeuf%' OR LOWER(name) LIKE '%œuf%' OR LOWER(name) LIKE '%œufs%' OR
    LOWER(name) LIKE '%porc%' OR LOWER(name) LIKE '%agneau%' OR LOWER(name) LIKE '%crevette%' OR
    LOWER(name) LIKE '%thon%' OR LOWER(name) LIKE '%jambon%' OR LOWER(name) LIKE '%bacon%' OR
    LOWER(name) LIKE '%steak%' OR LOWER(name) LIKE '%filet%' OR LOWER(name) LIKE '%côte%' OR
    LOWER(name) LIKE '%tofu%' OR LOWER(name) LIKE '%lentille%' OR LOWER(name) LIKE '%pois chiche%'
  );

  UPDATE foods SET category = 'dairy' 
  WHERE category = 'autre' AND (
    LOWER(name) LIKE '%lait%' OR LOWER(name) LIKE '%yaourt%' OR LOWER(name) LIKE '%fromage%' OR
    LOWER(name) LIKE '%crème%' OR LOWER(name) LIKE '%beurre%' OR LOWER(name) LIKE '%lactose%' OR
    LOWER(name) LIKE '%fromage blanc%' OR LOWER(name) LIKE '%ricotta%' OR LOWER(name) LIKE '%mozzarella%' OR
    LOWER(name) LIKE '%cheddar%'
  );

  UPDATE foods SET category = 'grains' 
  WHERE category = 'autre' AND (
    LOWER(name) LIKE '%pain%' OR LOWER(name) LIKE '%riz%' OR LOWER(name) LIKE '%pâtes%' OR
    LOWER(name) LIKE '%blé%' OR LOWER(name) LIKE '%avoine%' OR LOWER(name) LIKE '%seigle%' OR
    LOWER(name) LIKE '%orge%' OR LOWER(name) LIKE '%maïs%' OR LOWER(name) LIKE '%muesli%' OR
    LOWER(name) LIKE '%céréale%' OR LOWER(name) LIKE '%farine%' OR LOWER(name) LIKE '%crackers%'
  );

  UPDATE foods SET category = 'oils' 
  WHERE category = 'autre' AND (
    LOWER(name) LIKE '%huile%' OR LOWER(name) LIKE '%beurre de cacahuète%' OR LOWER(name) LIKE '%beurre d%' OR
    LOWER(name) LIKE '%margarine%' OR LOWER(name) LIKE '%graisse%' OR LOWER(name) LIKE '%cacahuète%' OR
    LOWER(name) LIKE '%amande%' OR LOWER(name) LIKE '%noix%' OR LOWER(name) LIKE '%olive%'
  );

  UPDATE foods SET category = 'beverages' 
  WHERE category = 'autre' AND (
    LOWER(name) LIKE '%eau%' OR LOWER(name) LIKE '%café%' OR LOWER(name) LIKE '%thé%' OR
    LOWER(name) LIKE '%jus%' OR LOWER(name) LIKE '%soda%' OR LOWER(name) LIKE '%vin%' OR
    LOWER(name) LIKE '%bière%' OR LOWER(name) LIKE '%smoothie%' OR LOWER(name) LIKE '%milk%'
  );

END $$;
